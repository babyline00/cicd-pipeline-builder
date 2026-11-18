/**
 * Secrets helpers. GitHub Actions secret names must match `[A-Z_][A-Z0-9_]*`
 * (start with a letter or underscore, then uppercase letters/digits/underscores).
 * Lowercase, digits-first, hyphens and spaces are all rejected.
 *
 * References in YAML are written as `${{ secrets.NAME }}`.
 */

export function validateSecretName(name: string): boolean {
  if (typeof name !== "string") return false
  if (name.length === 0) return false
  if (name.length > 64) return false
  // GitHub secret naming rules: uppercase letters, digits, underscores.
  // Must start with a letter or underscore (not a digit).
  return /^[A-Z_][A-Z0-9_]*$/.test(name)
}

export function formatSecretsRef(name: string): string {
  return `\${{ secrets.${name} }}`
}

/**
 * Scan a YAML string for `${{ secrets.X }}` references and return the list of
 * secret names referenced. Used by the "Required secrets" comment block.
 */
export function extractSecretRefs(yaml: string): string[] {
  if (typeof yaml !== "string") return []
  const re = /\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/g
  const out = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(yaml)) !== null) {
    out.add(m[1])
  }
  return Array.from(out)
}
