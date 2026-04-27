const fs = require('fs');
let content = fs.readFileSync('ferreteria_refactor/frontend_web/src/pages/Restaurant/RecipeEditor.jsx', 'utf8');

// Fix 'export default RecipeEditor;tor;'
content = content.replace(/export default RecipeEditor;tor;/g, 'export default RecipeEditor;');

// Fix all catch blocks with unused variables
// We'll replace `catch (err) {` and `catch (_) {` with `catch (error) {` 
// and then use it or remove it. But since we need to remove it if unused:
// If it's `catch (error)` and we don't use `error.`, we just use `catch ()`? No, JS requires a binding in older versions. 
// Standard trick: `catch (error) { console.error(error); ... }`

// Let's just blindly replace all catches to use `(error)` and add a `console.error(error);` if not present.
content = content.replace(/catch \([^)]+\) \{/g, 'catch (error) {');

// Now ensure every catch block has console.error(error); as the first statement, unless it already has it.
content = content.replace(/catch \(error\) \{\n(\s*)(?!console\.error)/g, 'catch (error) {\n$1console.error(error);\n$1');

fs.writeFileSync('ferreteria_refactor/frontend_web/src/pages/Restaurant/RecipeEditor.jsx', content, 'utf8');
