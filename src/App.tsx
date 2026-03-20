import { useState, useEffect, useCallback, useRef } from 'react'
import { useKeyboard, useRenderer } from '@opentui/react'
import type { PictModel, PictOptions, OutputConfig, TestCase } from './types'
import { runPict } from './pict/runner'
import { parseModelFile, buildModelFile } from './pict/model'
import { saveTestCases } from './output/writer'
import { ModelTab } from './components/ModelTab'
import { OptionsTab } from './components/OptionsTab'
import { ResultsTab } from './components/ResultsTab'
import { StatusBar } from './components/StatusBar'

const TAB_OPTIONS = [
  { name: 'Model', description: 'Define parameters and constraints' },
  { name: 'Options', description: 'Configure PICT and output' },
  { name: 'Results', description: 'View generated test cases' },
]

type ActivePanel = 'params' | 'values' | 'constraints' | 'adding'
type ActiveOptionField = 'filepath' | 'order' | 'randomize' | 'caseSensitive' | 'none'

const OPTION_FIELDS: ActiveOptionField[] = ['filepath', 'order', 'randomize', 'caseSensitive', 'none']

export function App() {
  const renderer = useRenderer()

  // Refs for imperative access
  const tabSelectRef = useRef<any>(null)
  const constraintsRef = useRef<any>(null)

  // --- Main state ---
  const [activeTab, setActiveTabState] = useState(0)
  const [model, setModel] = useState<PictModel>({ parameters: [], constraints: '' })
  const [options, setOptions] = useState<PictOptions>({ order: 2, randomize: false, caseSensitive: false })
  const [outputConfig, setOutputConfig] = useState<OutputConfig>({ filePath: './output.txt', format: 'txt' })
  const [results, setResults] = useState<TestCase[]>([])
  const [status, setStatus] = useState('')
  const [statusIsError, setStatusIsError] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // --- Model tab state ---
  const [activePanel, setActivePanel] = useState<ActivePanel>('params')
  const [selectedParamIndex, setSelectedParamIndex] = useState(0)
  const [newParamName, setNewParamName] = useState('')
  const [valuesInput, setValuesInput] = useState('')
  const [constraintsKey, setConstraintsKey] = useState(0)

  // --- Options tab state ---
  const [activeOptionField, setActiveOptionField] = useState<ActiveOptionField>('none')

  const setActiveTab = useCallback((tab: number) => {
    setActiveTabState(tab)
    tabSelectRef.current?.setSelectedIndex(tab)
  }, [])

  // Sync valuesInput when selected param changes
  useEffect(() => {
    const param = model.parameters[selectedParamIndex]
    setValuesInput(param ? param.values.join(', ') : '')
  // Only re-sync when the selected index changes (not on every model change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParamIndex])

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatus(msg)
    setStatusIsError(isError)
    setTimeout(() => setStatus(''), 4000)
  }, [])

  // --- Actions ---
  const handleParamNavigate = useCallback((index: number) => {
    setSelectedParamIndex(index)
  }, [])

  const handleValuesChange = useCallback((value: string) => {
    setValuesInput(value)
    const parts = value.split(',').map(v => v.trim()).filter(v => v.length > 0)
    setModel(m => ({
      ...m,
      parameters: m.parameters.map((p, i) =>
        i === selectedParamIndex ? { ...p, values: parts } : p
      ),
    }))
  }, [selectedParamIndex])

  const handleConfirmAddParam = useCallback(() => {
    const name = newParamName.trim()
    if (!name) return
    setModel(m => {
      const newParams = [...m.parameters, { name, values: [] }]
      setSelectedParamIndex(newParams.length - 1)
      setValuesInput('')
      return { ...m, parameters: newParams }
    })
    setNewParamName('')
    setActivePanel('params')
  }, [newParamName])

  const handleDeleteParam = useCallback(() => {
    setModel(m => {
      if (m.parameters.length === 0) return m
      return { ...m, parameters: m.parameters.filter((_, i) => i !== selectedParamIndex) }
    })
    setSelectedParamIndex(i => Math.max(0, i - 1))
  }, [selectedParamIndex])

  const handleGenerate = useCallback(async () => {
    const currentConstraints = constraintsRef.current?.editBuffer?.getText() ?? model.constraints
    const modelToRun = { ...model, constraints: currentConstraints }

    if (modelToRun.parameters.length === 0) {
      showStatus('Add at least one parameter first', true)
      return
    }
    const hasEmptyValues = modelToRun.parameters.some(p => p.values.length === 0)
    if (hasEmptyValues) {
      showStatus('All parameters must have at least one value', true)
      return
    }
    setIsGenerating(true)
    showStatus('Generating...')
    try {
      const testCases = await runPict(modelToRun, options)
      setResults(testCases)
      setActiveTab(2)
      showStatus(`Generated ${testCases.length} test cases`)
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Generation failed', true)
    } finally {
      setIsGenerating(false)
    }
  }, [model, options, showStatus, setActiveTab])

  const handleSaveResults = useCallback(async () => {
    if (results.length === 0) return
    const headers = Object.keys(results[0]!)
    try {
      await saveTestCases(headers, results, outputConfig)
      showStatus(`Saved ${results.length} test cases to ${outputConfig.filePath}`)
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Save failed', true)
    }
  }, [results, outputConfig, showStatus])

  const handleSaveModel = useCallback(async () => {
    const currentConstraints = constraintsRef.current?.editBuffer?.getText() ?? model.constraints
    const modelToSave = { ...model, constraints: currentConstraints }
    const path = './model.txt'
    try {
      await Bun.write(path, buildModelFile(modelToSave))
      showStatus(`Model saved to ${path}`)
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Save failed', true)
    }
  }, [model, showStatus])

  const handleOpenModel = useCallback(async () => {
    const path = './model.txt'
    try {
      const content = await Bun.file(path).text()
      const loaded = parseModelFile(content)
      setModel(loaded)
      setSelectedParamIndex(0)
      setValuesInput(loaded.parameters[0]?.values.join(', ') ?? '')
      setConstraintsKey(k => k + 1)
      setActiveTab(0)
      setActivePanel('params')
      showStatus(`Loaded model from ${path} (${loaded.parameters.length} parameters)`)
    } catch {
      showStatus(`Could not read ${path}`, true)
    }
  }, [showStatus, setActiveTab])

  // --- Keyboard handler ---
  useKeyboard((key) => {
    const { name, ctrl } = key

    // Always: quit via Ctrl+C
    if (ctrl && name === 'c') { renderer.destroy(); return }

    // Escape: exit current input mode
    if (name === 'escape') {
      if (activePanel === 'adding') { setActivePanel('params'); setNewParamName(''); return }
      if (activeTab === 0 && (activePanel === 'values' || activePanel === 'constraints')) {
        setActivePanel('params'); return
      }
      if (activeTab === 1 && activeOptionField !== 'none') {
        setActiveOptionField('none'); return
      }
      return
    }

    // Adding param: Enter to confirm, all other keys handled by <input>
    if (activePanel === 'adding') {
      if (name === 'return') { handleConfirmAddParam(); return }
      return
    }

    // Values panel: Escape handled above; all other keys go to <input>
    if (activeTab === 0 && activePanel === 'values') {
      return
    }

    // Constraints panel: Escape handled above; all other keys go to <textarea>
    if (activeTab === 0 && activePanel === 'constraints') {
      return
    }

    // Options text fields: keys go to <input>
    if (activeTab === 1 && (activeOptionField === 'filepath' || activeOptionField === 'order')) {
      if (name === 'tab') {
        const idx = OPTION_FIELDS.indexOf(activeOptionField)
        setActiveOptionField(OPTION_FIELDS[(idx + 1) % OPTION_FIELDS.length]!)
        return
      }
      return
    }

    // --- Not in text editing mode from here ---

    // Tab key for panel/field cycling
    if (name === 'tab') {
      if (activeTab === 0 && activePanel === 'params') {
        setActivePanel('values'); return
      }
      if (activeTab === 1) {
        const idx = OPTION_FIELDS.indexOf(activeOptionField)
        setActiveOptionField(OPTION_FIELDS[(idx + 1) % OPTION_FIELDS.length]!)
        return
      }
      return
    }

    // Switch tabs with number keys or [ ]
    if (name === '1') { setActiveTab(0); return }
    if (name === '2') { setActiveTab(1); return }
    if (name === '3') { setActiveTab(2); return }
    if (name === '[') { setActiveTab((activeTab - 1 + 3) % 3); return }
    if (name === ']') { setActiveTab((activeTab + 1) % 3); return }

    // Global actions
    if (name === 'q') { renderer.destroy(); return }
    if (name === 'g' && !isGenerating) { void handleGenerate(); return }
    if (name === 's') { void handleSaveResults(); return }
    if (name === 'o') { void handleOpenModel(); return }
    if (name === 'w') { void handleSaveModel(); return }

    // Model tab – params panel shortcuts
    if (activeTab === 0 && activePanel === 'params') {
      if (name === 'a') { setActivePanel('adding'); setNewParamName(''); return }
      if (name === 'd') { handleDeleteParam(); return }
      if (name === 'e') { setActivePanel('values'); return }
      if (name === 'c') { setActivePanel('constraints'); return }
      return
    }

    // Options tab: toggle fields with Enter
    if (activeTab === 1) {
      if (name === 'return') {
        if (activeOptionField === 'randomize') {
          setOptions(o => ({ ...o, randomize: !o.randomize })); return
        }
        if (activeOptionField === 'caseSensitive') {
          setOptions(o => ({ ...o, caseSensitive: !o.caseSensitive })); return
        }
      }
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box
        flexDirection="row"
        alignItems="center"
        gap={2}
        paddingX={2}
        backgroundColor="#0d1117"
      >
        <text fg="#5fafff"><strong> Pairwise TUI </strong></text>
        <tab-select
          ref={tabSelectRef}
          options={TAB_OPTIONS}
          onChange={(index) => setActiveTabState(index)}
          tabWidth={14}
        />
      </box>

      {/* Content */}
      <box flexGrow={1} flexDirection="column">
        {activeTab === 0 && (
          <ModelTab
            model={model}
            activePanel={activePanel}
            selectedParamIndex={selectedParamIndex}
            newParamName={newParamName}
            valuesInput={valuesInput}
            constraintsKey={constraintsKey}
            constraintsRef={constraintsRef}
            onParamNavigate={handleParamNavigate}
            onValuesChange={handleValuesChange}
            onNewParamNameChange={setNewParamName}
          />
        )}
        {activeTab === 1 && (
          <OptionsTab
            options={options}
            outputConfig={outputConfig}
            activeField={activeOptionField}
            onOutputConfigChange={setOutputConfig}
            onOptionsChange={setOptions}
          />
        )}
        {activeTab === 2 && (
          <ResultsTab
            results={results}
            focused={activeTab === 2}
          />
        )}
      </box>

      {/* Status message */}
      {status !== '' && (
        <box paddingX={2} backgroundColor={statusIsError ? '#3a0000' : '#001a00'}>
          <text fg={statusIsError ? '#ff6666' : '#66ff66'}>{status}</text>
        </box>
      )}

      {/* Status bar */}
      <StatusBar
        activeTab={activeTab}
        activePanel={activePanel}
        addingParam={activePanel === 'adding'}
        hasResults={results.length > 0}
        activeOptionField={activeOptionField}
      />
    </box>
  )
}
