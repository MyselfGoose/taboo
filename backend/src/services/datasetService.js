const fs = require("node:fs");
const path = require("node:path");

const { AppError } = require("../utils/appError");

function defaultDatasetPath(config) {
  if (config.datasetFilePath) {
    return path.resolve(config.datasetFilePath);
  }

  return path.resolve(__dirname, "../../../Dataset/taboo.json");
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

class DatasetService {
  constructor({ config, logger }) {
    this.logger = logger;
    this.datasetPath = defaultDatasetPath(config || {});
    this.categories = this.loadDataset();
  }

  loadDataset() {
    let parsed;

    try {
      const raw = fs.readFileSync(this.datasetPath, "utf8");
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Failed to load dataset file at ${this.datasetPath}: ${error.message}`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Dataset root must be an array of categories.");
    }

    const categories = [];

    for (const categoryEntry of parsed) {
      const categoryId = Number(categoryEntry.categoryId);
      const categoryName = normalizeText(categoryEntry.category);

      if (!Number.isInteger(categoryId) || categoryId <= 0 || !categoryName) {
        continue;
      }

      const words = Array.isArray(categoryEntry.words)
        ? categoryEntry.words
        : [];
      const seenKeys = new Set();
      const normalizedWords = [];

      for (const wordEntry of words) {
        const question = normalizeText(wordEntry?.question);
        const options = Array.isArray(wordEntry?.options)
          ? wordEntry.options
              .map((option) => normalizeText(option))
              .filter(Boolean)
          : [];

        if (!question || options.length < 2) {
          continue;
        }

        const key = `${categoryId}:${question.toLowerCase()}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);

        normalizedWords.push({
          id: key,
          question,
          options,
          categoryId,
          categoryName,
        });
      }

      categories.push({
        categoryId,
        category: categoryName,
        categoryImageUrl: normalizeText(categoryEntry.categoryImageUrl) || null,
        categoryDescription:
          normalizeText(categoryEntry.categoryDescription) || null,
        words: normalizedWords,
      });
    }

    this.logger.info("Dataset loaded", {
      event: "dataset_loaded",
      path: this.datasetPath,
      categoryCount: categories.length,
    });

    return categories;
  }

  getCategorySummaries() {
    return this.categories.map((category) => ({
      categoryId: category.categoryId,
      category: category.category,
      categoryImageUrl: category.categoryImageUrl,
      categoryDescription: category.categoryDescription,
      wordCount: category.words.length,
      selectable: category.words.length > 0,
    }));
  }

  getSelectableCategorySummaries() {
    return this.getCategorySummaries().filter((entry) => entry.selectable);
  }

  resolveCategorySelection({ categoryMode, categoryIds }) {
    const requestedMode = categoryMode === "single" ? "single" : "all";
    const selectable = this.categories.filter(
      (category) => category.words.length > 0,
    );

    if (requestedMode === "all") {
      return {
        categoryMode: "all",
        categoryIds: selectable.map((entry) => entry.categoryId),
      };
    }

    const requestedId = Number(
      Array.isArray(categoryIds) ? categoryIds[0] : categoryIds,
    );
    if (!Number.isInteger(requestedId)) {
      throw new AppError(
        "A valid category must be selected.",
        400,
        "INVALID_CATEGORY",
      );
    }

    const selected = selectable.find(
      (category) => category.categoryId === requestedId,
    );

    if (!selected) {
      throw new AppError(
        "Selected category is invalid or empty.",
        400,
        "INVALID_CATEGORY",
      );
    }

    return {
      categoryMode: "single",
      categoryIds: [selected.categoryId],
    };
  }

  getCategoryNames(categoryIds) {
    const names = categoryIds
      .map((id) =>
        this.categories.find((category) => category.categoryId === id),
      )
      .filter(Boolean)
      .map((category) => category.category);

    return names;
  }

  buildDeck(categoryIds) {
    const allowed = new Set(categoryIds);
    const cards = [];

    for (const category of this.categories) {
      if (!allowed.has(category.categoryId)) {
        continue;
      }

      for (const word of category.words) {
        cards.push({
          id: word.id,
          question: word.question,
          taboo: word.options,
          categoryId: word.categoryId,
          category: word.categoryName,
        });
      }
    }

    for (let index = cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = cards[index];
      cards[index] = cards[swapIndex];
      cards[swapIndex] = current;
    }

    return cards;
  }
}

module.exports = {
  DatasetService,
};
