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

  // Generate preview content based on selected format
  const previewContent = useMemo(() => {
    if (exportFormat === "figma") {
      // Show a summary for Figma export
      const colorCount = groups.reduce((sum, g) => sum + g.colors.length, 0)
      const stopCount = exportData.length
      return `Figma Variables Export\n\nCollection: "${collectionName}"\nColors: ${colorCount}\nVariables: ${stopCount}\n\nClick "Export to Figma" to create variables.`
    }

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

    // Limit preview to first ~15 lines
    const lines = fullContent.split("\n")
    if (lines.length > 15) {
      return lines.slice(0, 15).join("\n") + "\n..."
    }
    return fullContent
  }, [exportFormat, cssColorFormat, exportData, collectionName, groups])

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

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="export-modal">
        <div className="export-modal-header">
          <h2 className="export-modal-title">Export Colors</h2>
          <button className="export-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="export-modal-body">
          {/* Collection Name Input */}
          <div className="export-modal-section">
            <label className="export-modal-label">Collection Name</label>
            <input
              type="text"
              className="export-modal-input"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Enter collection name..."
            />
          </div>

          {/* Format Selection */}
          <div className="export-modal-section">
            <label className="export-modal-label">Export Format</label>
            <div className="export-format-options">
              <label className="export-format-option">
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === "figma"}
                  onChange={() => setExportFormat("figma")}
                />
                <span>Figma Variables</span>
              </label>
              <label className="export-format-option">
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === "css"}
                  onChange={() => setExportFormat("css")}
                />
                <span>CSS Custom Properties</span>
              </label>
              <label className="export-format-option">
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === "json"}
                  onChange={() => setExportFormat("json")}
                />
                <span>JSON (W3C Design Tokens)</span>
              </label>
              <label className="export-format-option">
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === "oklch-raw"}
                  onChange={() => setExportFormat("oklch-raw")}
                />
                <span>OKLCH Values (CSV)</span>
              </label>
            </div>
          </div>

          {/* CSS Color Format (only shown when CSS is selected) */}
          {exportFormat === "css" && (
            <div className="export-modal-section">
              <label className="export-modal-label">Color Format</label>
              <select
                className="export-modal-select"
                value={cssColorFormat}
                onChange={(e) => setCssColorFormat(e.target.value as CSSColorFormat)}
              >
                <option value="hex">Hex (#FFFFFF)</option>
                <option value="rgb">RGB (rgb(255, 255, 255))</option>
                <option value="oklch">OKLCH (oklch(100% 0 0))</option>
                <option value="hsl">HSL (hsl(0, 0%, 100%))</option>
              </select>
            </div>
          )}

          {/* Preview */}
          <div className="export-modal-section">
            <label className="export-modal-label">Preview</label>
            <pre className="export-modal-preview">{previewContent}</pre>
          </div>
        </div>

        {/* Actions */}
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
                {copySuccess ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button className="export-modal-btn" onClick={handleDownload}>
                Download
              </button>
            </>
          )}
          <button className="export-modal-btn secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
