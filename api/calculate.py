"""
ADESE — Microservicio de Regresión Econométrica
POST /api/calculate
FastAPI serverless function para Vercel.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import math
import traceback

def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def norm_pdf(x):
    return (1.0 / math.sqrt(2.0 * math.pi)) * math.exp(-0.5 * x**2)

def chi2_sf(x, df):
    if x <= 0: return 1.0
    term1 = x / df
    term2 = 2.0 / (9.0 * df)
    z = (term1**(1.0/3.0) - (1.0 - term2)) / math.sqrt(term2)
    return 1.0 - norm_cdf(z)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class VariableSpec(BaseModel):
    name: str
    data: list


class CalculateRequest(BaseModel):
    y: VariableSpec
    x_vars: list[VariableSpec]
    confidence: float = 0.95  # 0.90, 0.95, 0.99


class CoefficientResult(BaseModel):
    name: str
    coef: float
    std_err: float
    t_stat: float
    p_value: float
    ci_lower: float
    ci_upper: float
    significance: str  # ***, **, *, or ""


class CalculateResponse(BaseModel):
    n: int
    r_squared: float
    r_squared_adj: float
    se_type: str  # "Convencional (OLS)" or "Robusto (HC3)"
    hetero_test_pvalue: float
    is_heteroscedastic: bool
    coefficients: list[CoefficientResult]
    scatter_data: list[dict] | None = None
    fitted_line: list[dict] | None = None
    gaussian_curve: list[dict]
    critical_value: float


def significance_stars(p: float) -> str:
    if p < 0.01:
        return "***"
    elif p < 0.05:
        return "**"
    elif p < 0.10:
        return "*"
    return ""


@app.post("/api/calculate")
async def calculate(req: CalculateRequest):
    try:
        # --- 1. Data parsing & validation ---
        y_data = pd.to_numeric(pd.Series(req.y.data), errors="coerce").dropna()
        x_frames = {}
        for xv in req.x_vars:
            s = pd.to_numeric(pd.Series(xv.data), errors="coerce")
            x_frames[xv.name] = s

        X_df = pd.DataFrame(x_frames).dropna()

        # Align indices
        common_idx = y_data.index.intersection(X_df.index)
        y_vec = y_data.loc[common_idx].reset_index(drop=True)
        X_mat = X_df.loc[common_idx].reset_index(drop=True)

        n = len(y_vec)
        k = X_mat.shape[1]

        # Degrees of freedom check
        if n <= k + 1:
            raise HTTPException(
                status_code=400,
                detail=f"Grados de libertad insuficientes: n={n}, k+1={k+1}. Se necesitan al menos {k+2} observaciones.",
            )

        # --- 2. Add constant (intercept column) ---
        X_const = sm.add_constant(X_mat)

        # --- 3. Manual OLS ---
        X_arr = X_const.values
        y_arr = y_vec.values

        try:
            XTX = X_arr.T @ X_arr
            XTX_inv = np.linalg.inv(XTX)
            beta = XTX_inv @ X_arr.T @ y_arr
        except np.linalg.LinAlgError:
            raise HTTPException(
                status_code=400,
                detail="Error: Alta multicolinealidad o matriz singular detectada.",
            )

        y_pred = X_arr @ beta
        residuals = y_arr - y_pred

        # --- 4. Breusch-Pagan test ---
        y_bp = residuals**2
        y_bp_mean = np.mean(y_bp)
        try:
            beta_bp = XTX_inv @ X_arr.T @ y_bp
            y_bp_pred = X_arr @ beta_bp
            ss_total_bp = np.sum((y_bp - y_bp_mean) ** 2)
            ss_resid_bp = np.sum((y_bp - y_bp_pred) ** 2)
            r_sq_bp = 1 - (ss_resid_bp / ss_total_bp) if ss_total_bp > 0 else 0.0
            bp_lm = n * r_sq_bp
            bp_pvalue = chi2_sf(bp_lm, k)
        except Exception:
            bp_pvalue = 1.0

        is_hetero = bp_pvalue < 0.05

        # --- 5. Variance-Covariance Matrix ---
        if is_hetero:
            # HC3
            H_diag = np.sum(X_arr * (X_arr @ XTX_inv), axis=1)
            leverage_factor = np.clip(1 - H_diag, 0.001, 1.0)
            omega_diag = residuals**2 / (leverage_factor**2)
            X_omega = X_arr * omega_diag[:, np.newaxis]
            XT_Omega_X = X_omega.T @ X_arr
            var_cov = XTX_inv @ XT_Omega_X @ XTX_inv
            se_type = "Robusto (HC3)"
        else:
            # Conventional
            sigma_sq = np.sum(residuals**2) / (n - k - 1)
            var_cov = XTX_inv * sigma_sq
            se_type = "Convencional (OLS)"

        se = np.sqrt(np.diag(var_cov))
        t_stats = beta / se
        p_values = np.array([2 * (1.0 - norm_cdf(abs(ts))) for ts in t_stats])

        # Confidence intervals
        alpha = 1 - req.confidence
        if req.confidence == 0.90: t_crit = 1.645
        elif req.confidence == 0.99: t_crit = 2.576
        else: t_crit = 1.96 # 0.95
        
        ci_lower = beta - t_crit * se
        ci_upper = beta + t_crit * se

        # R-squared
        y_mean = np.mean(y_arr)
        ss_total = np.sum((y_arr - y_mean) ** 2)
        ss_residual = np.sum(residuals**2)
        r_squared = 1 - (ss_residual / ss_total)
        r_squared_adj = 1 - ((1 - r_squared) * (n - 1) / (n - k - 1))

        # --- 6. Build coefficient results ---
        coefficients = []
        param_names = ["Intercepto (β₀)"] + [xv.name for xv in req.x_vars]
        for i, name in enumerate(param_names):
            coef_val = float(beta[i])
            se_val = float(se[i])
            t_val = float(t_stats[i])
            p_val = float(p_values[i])
            ci_lo = float(ci_lower[i])
            ci_hi = float(ci_upper[i])

            coefficients.append(
                CoefficientResult(
                    name=name,
                    coef=coef_val,
                    std_err=se_val,
                    t_stat=t_val,
                    p_value=p_val,
                    ci_lower=ci_lo,
                    ci_upper=ci_hi,
                    significance=significance_stars(p_val),
                )
            )

        # --- 7. Scatter & fitted line for first X variable ---
        scatter_data = None
        fitted_line = None
        if len(req.x_vars) >= 1:
            first_x_name = req.x_vars[0].name
            if first_x_name in X_mat.columns:
                x_col = X_mat[first_x_name]
                y_pred = model_final.fittedvalues

                scatter_data = [
                    {"x": float(x_col.iloc[j]), "y": float(y_vec.iloc[j])}
                    for j in range(n)
                ]

                # Sort for the fitted line
                sorted_idx = x_col.argsort()
                fitted_line = [
                    {"x": float(x_col.iloc[j]), "yhat": float(y_pred.iloc[j])}
                    for j in sorted_idx
                ]

        # --- 8. Gaussian curve data ---
        z_values = np.linspace(-4.0, 4.0, 200)
        gaussian_curve = [
            {"z": round(float(z), 4), "density": round(float(norm_pdf(z)), 6)}
            for z in z_values
        ]

        # Critical value for the confidence level
        critical_value = float(t_crit)

        return CalculateResponse(
            n=n,
            r_squared=float(r_squared),
            r_squared_adj=float(r_squared_adj),
            se_type=se_type,
            hetero_test_pvalue=float(bp_pvalue),
            is_heteroscedastic=is_hetero,
            coefficients=coefficients,
            scatter_data=scatter_data,
            fitted_line=fitted_line,
            gaussian_curve=gaussian_curve,
            critical_value=critical_value,
        )

    except HTTPException:
        raise
    except np.linalg.LinAlgError:
        raise HTTPException(
            status_code=400,
            detail="Error: Alta multicolinealidad o matriz singular detectada.",
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
