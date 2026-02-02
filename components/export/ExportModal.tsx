import React, { useState, useMemo } from "react"
import type { ColorGroup, GlobalConfig, ExportFormat, CSSColorFormat } from "../../lib/types"
import {
  prepareExportData,
  generateCSS,
  generateJSON,
  generateOKLCH,
  copyToClipboard,
  downloadFile,
  getFileExtension,
  getMimeType
} from "../../lib/export-utils"

interface ExportModalProps {
  groups: ColorGroup[]
  globalConfig: GlobalConfig
  onExportToFigma: (collectionName: string) => void
  onClose: () => void
}

// Format configuration for the sidebar
const FORMAT_CONFIG: {
  id: ExportFormat
  icon: string
  name: string
}[] = [
  { id: "figma", icon: "◇", name: "Figma Variables" },
  { id: "css", icon: "{ }", name: "CSS" },
  { id: "json", icon: "{ }", name: "Design Tokens" },
  { id: "oklch-raw", icon: "☰", name: "CSV" }
]

// CSS color format options
const CSS_FORMAT_OPTIONS: {
  id: CSSColorFormat
  name: string
  example: string
}[] = [
  { id: "hex", name: "Hex", example: "#3B82F6" },
  { id: "rgb", name: "RGB", example: "rgb(59, 130, 246)" },
  { id: "oklch", name: "OKLCH", example: "oklch(62% 0.19 264)" },
  { id: "hsl", name: "HSL", example: "hsl(217, 91%, 60%)" }
]

export function ExportModal({
  groups,
  globalConfig,
  onExportToFigma,
  onClose
}: ExportModalProps) {
  const [collectionName, setCollectionName] = useState("Octarine")
  const [exportFormat, setExportFormat] = useState<ExportFormat>("figma")
  const [cssColorFormat, setCssColorFormat] = useState<CSSColorFormat>("hex")
  const [copySuccess, setCopySuccess] = useState(false)

  // Prepare export data once
  const exportData = useMemo(
    () => prepareExportData(groups, globalConfig),
    [groups, globalConfig]
  )

  // Count colors and variables for summary
  const colorCount = groups.reduce((sum, g) => sum + g.colors.length, 0)
  const variableCount = exportData.length

  // Generate preview content based on selected format
  const previewContent = useMemo(() => {
    let fullContent: string
    switch (exportFormat) {
      case "css":
        fullContent = generateCSS(exportData, cssColorFormat)
        break
      case "json":
        fullContent = generateJSON(exportData)
        break
      case "oklch-raw":
        fullContent = generateOKLCH(exportData)
        break
      default:
        fullContent = ""
    }
    return fullContent
  }, [exportFormat, cssColorFormat, exportData])

  // Generate full content for copy/download
  const generateFullContent = (): string => {
    switch (exportFormat) {
      case "css":
        return generateCSS(exportData, cssColorFormat)
      case "json":
        return generateJSON(exportData)
      case "oklch-raw":
        return generateOKLCH(exportData)
      default:
        return ""
    }
  }

  const handleCopy = async () => {
    const content = generateFullContent()
    const success = await copyToClipboard(content)
    if (success) {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleDownload = () => {
    const content = generateFullContent()
    const ext = getFileExtension(exportFormat as "css" | "json" | "oklch-raw")
    const mime = getMimeType(exportFormat as "css" | "json" | "oklch-raw")
    const filename = `${collectionName.toLowerCase().replace(/\s+/g, "-")}-colors.${ext}`
    downloadFile(content, filename, mime)
  }

  const handleExportToFigma = () => {
    onExportToFigma(collectionName)
    onClose()
  }

  // Get preview title based on format
  const getPreviewTitle = (): string => {
    switch (exportFormat) {
      case "figma":
        return "Figma Variables"
      case "css":
        return "CSS Custom Properties"
      case "json":
        return "JSON Design Tokens"
      case "oklch-raw":
        return "OKLCH Raw Data"
      default:
        return "Preview"
    }
  }

  // Render the options column content based on format
  const renderOptionsColumn = () => {
    switch (exportFormat) {
      case "figma":
        return (
          <>
            <label className="export-options-label">Collection Name</label>
            <input
              type="text"
              className="export-options-input"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Enter collection name..."
            />
            <div className="export-options-summary">
              {colorCount} color{colorCount !== 1 ? "s" : ""}, {variableCount} variable{variableCount !== 1 ? "s" : ""} will be created
            </div>
          </>
        )

      case "css":
        return (
          <>
            <label className="export-options-label">Color Format</label>
            <div className="export-color-format-cards">
              {CSS_FORMAT_OPTIONS.map((format) => (
                <div
                  key={format.id}
                  className={`export-color-format-card ${cssColorFormat === format.id ? "selected" : ""}`}
                  onClick={() => setCssColorFormat(format.id)}
                >
                  <div className="export-color-format-card-header">
                    <span className="export-color-format-card-name">{format.name}</span>
                    {cssColorFormat === format.id && (
                      <span className="export-color-format-card-check">✓</span>
                    )}
                  </div>
                  <div className="export-color-format-card-example">{format.example}</div>
                </div>
              ))}
            </div>
          </>
        )

      case "json":
        return (
          <div className="export-options-description">
            <strong>W3C Design Token format</strong>
            <br /><br />
            Standard for sharing design tokens across tools and platforms.
            <br /><br />
            Includes OKLCH values with hex fallback.
          </div>
        )

      case "oklch-raw":
        return (
          <div className="export-options-description">
            <strong>Raw OKLCH Data</strong>
            <br /><br />
            CSV format with color name, stop, and L/C/H values.
            <br /><br />
            Useful for spreadsheets or data analysis.
          </div>
        )

      default:
        return null
    }
  }

  // Render the preview column content based on format
  const renderPreviewColumn = () => {
    if (exportFormat === "figma") {
      return (
        <div className="export-figma-preview">
          {exportData.map((stop, index) => (
            <div key={index} className="export-figma-variable">
              <span className="export-figma-variable-name">
                {stop.colorLabel}/{stop.stopNumber}
              </span>
              <div
                className="export-figma-color-swatch"
                style={{ backgroundColor: stop.hex }}
              />
              <span className="export-figma-variable-hex">
                {stop.hex.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <pre className="export-preview-code">{previewContent}</pre>
    )
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="export-modal">
        {/* Header */}
        <div className="export-modal-header">
          <h2 className="export-modal-title">Export Colors</h2>
          <button className="export-modal-close" onClick={onClose}>×</button>
        </div>

        {/* 3-Column Layout */}
        <div className="export-layout">
          {/* Left Column - Format Sidebar */}
          <div className="export-format-sidebar">
            {FORMAT_CONFIG.map((format) => (
              <button
                key={format.id}
                className={`export-format-btn ${exportFormat === format.id ? "selected" : ""}`}
                onClick={() => setExportFormat(format.id)}
              >
                <span className="export-format-btn-icon">{format.icon}</span>
                <span className="export-format-btn-name">{format.name}</span>
              </button>
            ))}
          </div>

          {/* Middle Column - Options */}
          <div className="export-options-column">
            {renderOptionsColumn()}
          </div>

          {/* Right Column - Preview */}
          <div className="export-preview-column">
            <div className="export-preview-header">{getPreviewTitle()}</div>
            {renderPreviewColumn()}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="export-modal-actions">
          {exportFormat === "figma" ? (
            <button className="export-modal-btn primary" onClick={handleExportToFigma}>
              Export to Figma
            </button>
          ) : (
            <>
              <button
                className={`export-modal-btn ${copySuccess ? "success" : ""}`}
                onClick={handleCopy}
              >
                {copySuccess ? "Copied!" : "Copy"}
              </button>
              <button className="export-modal-btn" onClick={handleDownload}>
                Download
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
