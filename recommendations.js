const getCategoryPath = (categoryId, categoriesById) => {
  const path = [];
  const visited = new Set();
  let currentCategoryId = categoryId;

  while (currentCategoryId && !visited.has(currentCategoryId)) {
    visited.add(currentCategoryId);
    path.push(currentCategoryId);
    currentCategoryId = categoriesById.get(currentCategoryId)?.parent_category_id || null;
  }

  return path;
};

const getLeafCategoryIds = (productCategories, categoriesById) => {
  const categoryIds = [...new Set((productCategories || []).map((category) => category?.id).filter(Boolean))];

  return categoryIds.filter((categoryId) => !categoryIds.some((otherCategoryId) => (
    otherCategoryId !== categoryId && getCategoryPath(otherCategoryId, categoriesById).includes(categoryId)
  )));
};

const getDescendantCategoryIds = (categoryId, categoriesById) => [...categoriesById.keys()].filter(
  (candidateCategoryId) => getCategoryPath(candidateCategoryId, categoriesById).includes(categoryId)
);

const selectCategoryRecommendations = async ({
  currentProduct,
  categories,
  loadProductsForCategories,
  mapProduct,
  limit = 8,
}) => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const leafCategoryIds = getLeafCategoryIds(currentProduct.categories, categoriesById);
  const categoryPaths = leafCategoryIds.map((categoryId) => getCategoryPath(categoryId, categoriesById));
  const recommendations = [];
  const recommendationIds = new Set([currentProduct.id]);
  const maxDepth = Math.max(0, ...categoryPaths.map((categoryPath) => categoryPath.length));

  for (let level = 0; level < maxDepth && recommendations.length < limit; level += 1) {
    const ancestorCategoryIds = [...new Set(categoryPaths
      .map((categoryPath) => categoryPath[level])
      .filter(Boolean))];

    if (!ancestorCategoryIds.length) {
      continue;
    }

    const descendantCategoryIds = [...new Set(ancestorCategoryIds.flatMap(
      (categoryId) => getDescendantCategoryIds(categoryId, categoriesById)
    ))];
    const candidates = await loadProductsForCategories(descendantCategoryIds);

    for (const candidate of candidates) {
      if (recommendationIds.has(candidate.id)) {
        continue;
      }

      recommendationIds.add(candidate.id);
      recommendations.push(mapProduct(candidate));

      if (recommendations.length === limit) {
        break;
      }
    }
  }

  return recommendations;
};

module.exports = {
  selectCategoryRecommendations,
};
