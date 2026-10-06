from pydantic import BaseModel, ConfigDict, Field, computed_field

# Upper bounds for the optional nutrition inputs. These are not nutritional
# advice - they exist to catch typos such as a stray extra zero ("3500" for a
# plate of fries, or a negative value from a mis-hit minus key). Real dishes
# sit far below these limits, so a rejection here always means bad data entry
# rather than an unusual-but-valid item.
MAX_CALORIES = 5000
MAX_MACRO_G = 1000
MAX_FIBER_G = 500

# Atwater factors: kcal per gram.
KCAL_PER_G_PROTEIN = 4
KCAL_PER_G_CARBS = 4
KCAL_PER_G_FAT = 9


class MacroPercentages(BaseModel):
    """Share of the item's calories contributed by each macro.

    Percentages are of the macros' *combined* calorie total, not of the
    declared `calories` field. Those two numbers rarely agree exactly - a
    vendor declaring 350 kcal for a dish whose macros add up to 360 should
    still see a ratio that sums to 100%, not one that tops out at 97% and
    looks like a bug.
    """

    protein_pct: float
    carbs_pct: float
    fat_pct: float


class NutritionFields(BaseModel):
    """The optional nutrition block, shared by create/update/out.

    Kept as one class so the three schemas cannot drift apart: a field added
    here shows up in the create payload, the patch payload and the response.
    """

    # Free text, whatever separator the vendor used.
    ingredients: str | None = Field(default=None, max_length=2000)
    serving_size: str | None = Field(default=None, max_length=100)
    calories: int | None = Field(default=None, ge=0, le=MAX_CALORIES)
    protein_g: float | None = Field(default=None, ge=0, le=MAX_MACRO_G)
    carbs_g: float | None = Field(default=None, ge=0, le=MAX_MACRO_G)
    fat_g: float | None = Field(default=None, ge=0, le=MAX_MACRO_G)
    fiber_g: float | None = Field(default=None, ge=0, le=MAX_FIBER_G)


class MenuItemBase(NutritionFields):
    name: str
    description: str | None = None
    price: float = Field(gt=0)
    category: str | None = None
    image_url: str | None = None
    is_available: bool = True
    allergens: list[str] | str | None = None
    is_vegan: bool = False


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(NutritionFields):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    category: str | None = None
    image_url: str | None = None
    is_available: bool | None = None
    allergens: list[str] | str | None = None
    is_vegan: bool | None = None


class FlashDiscountUpdate(BaseModel):
    is_flash_discount: bool
    flash_discount_percent: int = Field(default=0, ge=0, le=90)


class MenuItemOut(NutritionFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_id: int
    name: str
    description: str | None = None
    price: float
    category: str | None = None
    image_url: str | None = None
    is_available: bool = True
    allergens: str | None = None
    is_vegan: bool = False
    is_flash_discount: bool = False
    flash_discount_percent: int = 0
    effective_price: float | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def macro_percentages(self) -> MacroPercentages | None:
        """Calorie share per macro, derived on read and never stored.

        Returns ``None`` unless calories *and* all three macros are present.
        A partial breakdown is worse than none: with only protein and fat
        entered, the resulting percentages would silently imply the missing
        carbs contribute nothing, which is a nutrition claim the vendor never
        made and the app cannot support.

        Also ``None`` when the three macros are all zero - there is no total to
        take a share of, and dividing by it would raise.
        """
        if self.calories is None:
            return None
        if self.protein_g is None or self.carbs_g is None or self.fat_g is None:
            return None

        protein_kcal = float(self.protein_g) * KCAL_PER_G_PROTEIN
        carbs_kcal = float(self.carbs_g) * KCAL_PER_G_CARBS
        fat_kcal = float(self.fat_g) * KCAL_PER_G_FAT
        total = protein_kcal + carbs_kcal + fat_kcal
        if total <= 0:
            return None

        return MacroPercentages(
            protein_pct=round(protein_kcal / total * 100, 1),
            carbs_pct=round(carbs_kcal / total * 100, 1),
            fat_pct=round(fat_kcal / total * 100, 1),
        )
