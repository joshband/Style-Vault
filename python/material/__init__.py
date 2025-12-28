"""Material analysis module for Visual DNA Studio."""
from .signals import extract_material_signals, MaterialSignals
from .recipes import MATERIAL_RECIPES, match_best_recipe, score_recipe
