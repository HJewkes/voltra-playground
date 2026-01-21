// Allow importing JSON files
declare module '*.json' {
  const value: unknown;
  export default value;
}
