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
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan
from scipy.stats import norm
import math
import traceback

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

        # --- 3. Initial OLS for Breusch-Pagan test ---
        try:
            model_ols = sm.OLS(y_vec, X_const).fit()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error: Alta multicolinealidad o matriz singular detectada. {str(e)}",
            )

        residuals = model_ols.resid

        # --- 4. Breusch-Pagan heteroscedasticity test ---
        try:
            bp_lm, bp_pvalue, _, _ = het_breuschpagan(residuals, X_const)
        except Exception:
            bp_pvalue = 1.0  # Assume homoscedasticity if test fails

        is_hetero = bp_pvalue < 0.05

        # --- 5. Final model based on diagnostics ---
        if is_hetero:
            try:
                model_final = sm.OLS(y_vec, X_const).fit(cov_type="HC3")
            except Exception:
                model_final = model_ols
            se_type = "Robusto (HC3)"
        else:
            model_final = model_ols
            se_type = "Convencional (OLS)"

        # --- 6. Build coefficient results ---
        alpha = 1 - req.confidence
        conf_intervals = model_final.conf_int(alpha=alpha)

        coefficients = []
        param_names = list(X_const.columns)
        for i, name in enumerate(param_names):
            label = "Intercepto (β₀)" if name == "const" else name
            coef_val = float(model_final.params.iloc[i])
            se_val = float(model_final.bse.iloc[i])
            t_val = float(model_final.tvalues.iloc[i])
            p_val = float(model_final.pvalues.iloc[i])
            ci_lo = float(conf_intervals.iloc[i, 0])
            ci_hi = float(conf_intervals.iloc[i, 1])

            coefficients.append(
                CoefficientResult(
                    name=label,
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
            {"z": round(float(z), 4), "density": round(float(norm.pdf(z)), 6)}
            for z in z_values
        ]

        # Critical value for the confidence level
        critical_value = float(norm.ppf(1 - alpha / 2))

        return CalculateResponse(
            n=n,
            r_squared=float(model_final.rsquared),
            r_squared_adj=float(model_final.rsquared_adj),
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
