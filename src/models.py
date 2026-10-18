# src/models.py
"""All candidate model definitions in one place (Guide 8.2)."""
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Lasso, LinearRegression, Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor


def linear_pipe(model):
    # Imputer and scaler are fitted on the training data only (inside the pipeline).
    return make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), model)


def tree_pipe(model):
    # Trees do not need scaling, only imputation.
    return make_pipeline(SimpleImputer(strategy="median"), model)


def candidate_models() -> dict:
    return {
        "linear": linear_pipe(LinearRegression()),
        "ridge": linear_pipe(Ridge(alpha=1.0)),
        "lasso": linear_pipe(Lasso(alpha=0.1, max_iter=10000)),
        "decision_tree": tree_pipe(DecisionTreeRegressor(max_depth=8, random_state=0)),
        "random_forest": tree_pipe(RandomForestRegressor(
            n_estimators=300, max_depth=12, min_samples_leaf=20,
            n_jobs=-1, random_state=0)),
        "xgboost": tree_pipe(XGBRegressor(
            n_estimators=400, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=0)),
    }


def apply_params(models: dict, params: dict) -> dict:
    """Set the tuned hyperparameters saved in configs/final_model.json onto fresh models."""
    for name, p in params.items():
        if name in models and isinstance(p, dict):
            models[name].set_params(**p)
    return models


def make_voting(top_names: list, models: dict):
    """Average the predictions of the selected models (equal weights)."""
    return VotingRegressor([(n, models[n]) for n in top_names])
