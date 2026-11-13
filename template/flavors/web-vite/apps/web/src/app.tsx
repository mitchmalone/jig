// Kept in a string: a placeholder in JSX expression position is valid syntax
// that formatters reshape.
const title = '{{PROJECT_TITLE}}'

export function App() {
  return <h1>{title}</h1>
}
