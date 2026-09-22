---
name: bt-seo
description: >-
  Use this skill when the user provides rough product details (like a tracklist, themes, or basic specs) and wants you to generate Thai SEO copy, update the products.json database, and rebuild the frontend for the BT Music Drive store.
---

# Copywriter SEO Skill

This skill teaches the agent how to generate high-quality Thai SEO copy for BT Music Drive products and inject it directly into the local database (`products.json`).

## Workflow

When the user asks to generate SEO copy or add a new product based on their rough data:

1. **Analyze Input**: Look at the provided tracklists, artist names, product capacity, and themes.
2. **Generate Copy**:
   *   **Product Name (Meta Title)**: Max 60 characters. Catchy, includes keywords (e.g., "แฟลชไดร์ฟเพลง MP3", artist name, capacity). Do NOT use duplicate words like "รวมเพลงรวมเพลง".
   *   **Description**: Must be in HTML format (use `<p>`, `<ul>`, `<li>`, `<strong>`, `<h4>`). Use emojis appropriately. Include:
       *   An engaging introductory paragraph (first 150 chars act as meta description).
       *   "✨ จุดเด่นของ BT Music Drive": Highlight "เสียบปุ๊บ ฟังปั๊บ (Plug & Play)", "ไม่ต้องใช้เน็ต", "คุณภาพเสียงคมชัด", and device compatibility.
       *   "🎁 ไอเดียของขวัญ": Suggest it as a great gift for elders/parents.
   *   **Tags / Keywords**: Generate an array of 5-8 relevant Thai SEO keywords (e.g., "แฟลชไดร์ฟเพลง", "USB ฟังในรถ", "เพลงลูกทุ่งเก่า"). This is critical for search and must be updated in the `tags` array of the product.
3. **Provide Output to User**:
   *   **Do NOT manually edit `products.json`** to update product copy! `products.json` is a read-only local fallback. The real database is on Neon (cloud), which we cannot modify without the Admin Password.
   *   Output the generated Title, Description (HTML), and Tags in a clean Markdown format so the user can easily copy and paste them into the Product Studio UI.
5. **Report**:
   *   Show the user the generated copy in markdown.
   *   Confirm that `products.json` was updated and `npm run build` was executed.
