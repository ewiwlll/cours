import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

/**
 * Nettoie et formate les expressions mathématiques LaTeX et symboles grecs
 * pour un rendu typographique net et lisible sur mobile.
 */
export function formatMath(text?: string | null): string {
  if (!text) return "";

  let res = String(text);

  // Virgules décimales LaTeX françaises (ex: 30{,}5 -> 30,5)
  res = res.replace(/\{,\}/g, ",");

  // Symboles grecs & delta
  res = res.replace(/\\Delta\s*G\^\{\\circ\'\}/g, "ΔG°'");
  res = res.replace(/\\Delta\s*G\^\\circ\'/g, "ΔG°'");
  res = res.replace(/\\Delta\s*G\^\{\\circ\}/g, "ΔG°");
  res = res.replace(/\\Delta\s*G\^\\circ/g, "ΔG°");
  res = res.replace(/\\Delta\s*G/g, "ΔG");
  res = res.replace(/\\Delta\s*H/g, "ΔH");
  res = res.replace(/\\Delta\s*S/g, "ΔS");
  res = res.replace(/\\Delta\s*C/g, "ΔC");
  res = res.replace(/\\Delta/g, "Δ");
  res = res.replace(/\\alpha/g, "α");
  res = res.replace(/\\beta/g, "β");
  res = res.replace(/\\gamma/g, "γ");
  res = res.replace(/\\pi/g, "π");
  res = res.replace(/\\mu/g, "μ");
  res = res.replace(/\\sigma/g, "σ");
  res = res.replace(/\\theta/g, "θ");

  // Exposants & indices physiques/chimiques (ex: mol^{-1} -> mol⁻¹)
  res = res.replace(/\^\{\-1\}/g, "⁻¹");
  res = res.replace(/\^\{\-2\}/g, "⁻²");
  res = res.replace(/\^\{\+1\}/g, "⁺¹");
  res = res.replace(/\^\{\+\}/g, "⁺");
  res = res.replace(/\^\{\-\}/g, "⁻");
  res = res.replace(/\^\{\s*2\+\s*\}/g, "²⁺");
  res = res.replace(/\^\{\s*2\-\s*\}/g, "²⁻");
  res = res.replace(/\^\{2\}/g, "²");
  res = res.replace(/\^\{3\}/g, "³");

  // Ions et indices/exposants chimiques
  res = res.replace(/3\s*\\text\{\s*Na\s*\}\^\{\+\}/g, "3 Na⁺");
  res = res.replace(/2\s*\\text\{\s*K\s*\}\^\{\+\}/g, "2 K⁺");
  res = res.replace(/\\text\{\s*Na\s*\}\^\{\+\}/g, "Na⁺");
  res = res.replace(/\\text\{\s*K\s*\}\^\{\+\}/g, "K⁺");
  res = res.replace(/\\text\{\s*Ca\s*\}\^\{\s*2\+\s*\}/g, "Ca²⁺");
  res = res.replace(/\\text\{\s*Cl\s*\}\^\{\-\}/g, "Cl⁻");
  res = res.replace(/\\text\{\s*([A-Za-z0-9_\-\+\/\s]+)\s*\}/g, "$1");
  res = res.replace(/\\text([A-Za-z0-9]+)/g, "$1");

  // Opérateurs et flèches
  res = res.replace(/\\rightarrow/g, " → ");
  res = res.replace(/\\leftarrow/g, " ← ");
  res = res.replace(/\\leftrightarrow/g, " ↔ ");
  res = res.replace(/\\Rightarrow/g, " ⇒ ");
  res = res.replace(/\\ll/g, " ≪ ");
  res = res.replace(/\\gg/g, " ≫ ");
  res = res.replace(/\\neq/g, " ≠ ");
  res = res.replace(/\\leq/g, " ≤ ");
  res = res.replace(/\\geq/g, " ≥ ");
  res = res.replace(/\\approx/g, " ≈ ");
  res = res.replace(/\\cdot/g, " · ");
  res = res.replace(/\\times/g, " × ");
  res = res.replace(/\\pm/g, " ± ");
  res = res.replace(/\\ln/g, "ln");
  res = res.replace(/\\log/g, "log");
  res = res.replace(/\\quad/g, "   ");
  res = res.replace(/\\,/g, " ");

  // Fractions \frac{A}{B}
  res = res.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");

  // Parenthèses adaptatives \left( \right)
  res = res.replace(/\\left\(/g, "(");
  res = res.replace(/\\right\)/g, ")");
  res = res.replace(/\\left\[/g, "[");
  res = res.replace(/\\right\]/g, "]");

  // Indices classiques
  res = res.replace(/_\{([a-zA-Z0-9_\-]+)\}/g, "_$1");
  res = res.replace(/K_\{eq\}/g, "K_eq");
  res = res.replace(/V_\{m\}/g, "V_m");

  // Supprimer les balises LaTeX résiduelles
  res = res.replace(/\$\$([\s\S]+?)\$\$/g, "$1");
  res = res.replace(/\$([^$]+)\$/g, "$1");
  res = res.replace(/\\\[([\s\S]+?)\\\]/g, "$1");
  res = res.replace(/\\\(([\s\S]+?)\\\)/g, "$1");

  // Nettoyer les balises Markdown bold restantes dans les petits morceaux
  res = res.replace(/\*\*([^*]+)\*\*/g, "$1");

  return res;
}

/**
 * Composant de rendu Markdown & KaTeX natif optimisé pour l'écran mobile
 */
export function MobileMarkdownViewer({ content }: { content: string }) {
  if (!content) return null;

  const rawBlocks = content.split(/\n\n+/);

  return (
    <View style={styles.container}>
      {rawBlocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. CALLOUTS : > [!WARNING], > [!NOTE], > [!TIP], > [!IMPORTANT]
        if (trimmed.startsWith("> [!")) {
          const match = trimmed.match(/^>\s*\[!(WARNING|CAUTION|IMPORTANT|NOTE|TIP)\]\s*\n?([\s\S]*)/i);
          if (match && match[1] && match[2]) {
            const type = match[1].toUpperCase();
            const isWarn = type === "WARNING" || type === "CAUTION";
            const isTip = type === "TIP" || type === "NOTE";
            const body = match[2].replace(/^>\s?/gm, "").trim();

            return (
              <View
                key={idx}
                style={[
                  styles.calloutBox,
                  isWarn ? styles.calloutWarn : isTip ? styles.calloutTip : styles.calloutInfo
                ]}
              >
                <View style={styles.calloutHeader}>
                  <Text
                    style={[
                      styles.calloutBadge,
                      isWarn ? styles.calloutBadgeWarn : isTip ? styles.calloutBadgeTip : styles.calloutBadgeInfo
                    ]}
                  >
                    {isWarn ? "⚠️ PIÈGE D'EXAMEN" : isTip ? "💡 POINT CLÉ" : "📌 IMPORTANT"}
                  </Text>
                </View>
                <Text style={styles.calloutText}>{formatMath(body)}</Text>
              </View>
            );
          }
        }

        // 2. TABLEAUX MARKDOWN : | Col 1 | Col 2 |
        if (trimmed.startsWith("|") && trimmed.includes("\n|")) {
          const lines = trimmed.split("\n").filter((l) => l.trim().startsWith("|"));
          if (lines.length >= 3 && lines[0]) {
            const headers = lines[0].split("|").slice(1, -1).map((c) => formatMath(c.trim()));
            const rows = lines.slice(2).map((row) =>
              row.split("|").slice(1, -1).map((c) => formatMath(c.trim()))
            );

            return (
              <View key={idx} style={styles.tableContainer}>
                {/* Header du tableau */}
                <View style={styles.tableHeaderRow}>
                  {headers.map((h, hIdx) => (
                    <View key={hIdx} style={[styles.tableCell, { flex: hIdx === 0 ? 1.1 : 1 }]}>
                      <Text style={styles.tableHeaderText}>{h}</Text>
                    </View>
                  ))}
                </View>
                {/* Lignes du tableau */}
                {rows.map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[
                      styles.tableRow,
                      rIdx % 2 === 1 && { backgroundColor: "rgba(39, 39, 42, 0.4)" }
                    ]}
                  >
                    {row.map((cell, cIdx) => (
                      <View key={cIdx} style={[styles.tableCell, { flex: cIdx === 0 ? 1.1 : 1 }]}>
                        <Text style={[styles.tableCellText, cIdx === 0 && styles.tableCellTextBold]}>
                          {cell}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          }
        }

        // 3. DISPLAY FORMULAS : $$ ... $$ ou \[ ... \]
        if (trimmed.startsWith("$$") || trimmed.startsWith("\\[")) {
          const cleanFormula = formatMath(trimmed);
          return (
            <View key={idx} style={styles.displayFormulaBox}>
              <Text style={styles.displayFormulaText}>{cleanFormula}</Text>
            </View>
          );
        }

        // 4. HEADERS : # , ## , ###
        if (trimmed.startsWith("# ")) {
          return (
            <Text key={idx} style={styles.h1}>
              {formatMath(trimmed.replace(/^#\s+/, ""))}
            </Text>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <Text key={idx} style={styles.h2}>
              {formatMath(trimmed.replace(/^##\s+/, ""))}
            </Text>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <Text key={idx} style={styles.h3}>
              {formatMath(trimmed.replace(/^###\s+/, ""))}
            </Text>
          );
        }

        // 5. CITATIONS / QUOTES SIMPLES : > ...
        if (trimmed.startsWith("> ")) {
          return (
            <View key={idx} style={styles.quoteBox}>
              <Text style={styles.quoteText}>{formatMath(trimmed.replace(/^>\s+/, ""))}</Text>
            </View>
          );
        }

        // 6. LISTES À PUCES : * ou -
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").filter((l) => l.trim().startsWith("* ") || l.trim().startsWith("- "));
          return (
            <View key={idx} style={{ gap: 6, marginVertical: 4 }}>
              {items.map((item, iIdx) => (
                <View key={iIdx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{formatMath(item.replace(/^[\*\-]\s+/, ""))}</Text>
                </View>
              ))}
            </View>
          );
        }

        // 7. PARAGRAPHE STANDARD
        return (
          <Text key={idx} style={styles.paragraph}>
            {formatMath(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  h1: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 12,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f4f4f5",
    marginTop: 12,
    marginBottom: 2,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  h3: {
    fontSize: 13,
    fontWeight: "700",
    color: "#e4e4e7",
    marginTop: 8,
    marginBottom: 2,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: "#d4d4d8",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    color: "#60a5fa",
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#d4d4d8",
    flex: 1,
  },
  displayFormulaBox: {
    backgroundColor: "rgba(24, 24, 27, 0.9)",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    marginVertical: 4,
  },
  displayFormulaText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 0.5,
  },
  calloutBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginVertical: 6,
    gap: 6,
  },
  calloutWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  calloutTip: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  calloutInfo: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "rgba(59, 130, 246, 0.35)",
  },
  calloutHeader: {
    flexDirection: "row",
  },
  calloutBadge: {
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  calloutBadgeWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    color: "#fbbf24",
  },
  calloutBadgeTip: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    color: "#34d399",
  },
  calloutBadgeInfo: {
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    color: "#60a5fa",
  },
  calloutText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#f4f4f5",
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    backgroundColor: "rgba(24, 24, 27, 0.5)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  quoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#a1a1aa",
    fontStyle: "italic",
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27272a",
    overflow: "hidden",
    marginVertical: 6,
    backgroundColor: "#18181b",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#27272a",
    borderBottomWidth: 1,
    borderBottomColor: "#3f3f46",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(63, 63, 70, 0.4)",
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  tableCellText: {
    fontSize: 11,
    color: "#d4d4d8",
    lineHeight: 16,
  },
  tableCellTextBold: {
    fontWeight: "700",
    color: "#e4e4e7",
  },
});
