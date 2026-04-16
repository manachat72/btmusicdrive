-- AlterTable: Add slug to Category
ALTER TABLE "Category" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- AlterTable: Add slug to Product
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
