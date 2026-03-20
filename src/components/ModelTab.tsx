import type { RefObject } from 'react'
import type { PictModel } from '../types'

interface ModelTabProps {
  model: PictModel
  activePanel: 'params' | 'values' | 'constraints' | 'adding'
  selectedParamIndex: number
  newParamName: string
  valuesInput: string
  constraintsKey: number
  constraintsRef: RefObject<any>
  onParamNavigate: (index: number) => void
  onValuesChange: (value: string) => void
  onNewParamNameChange: (name: string) => void
}

export function ModelTab({
  model,
  activePanel,
  selectedParamIndex,
  newParamName,
  valuesInput,
  constraintsKey,
  constraintsRef,
  onParamNavigate,
  onValuesChange,
  onNewParamNameChange,
}: ModelTabProps) {
  const paramOptions = model.parameters.map(p => ({
    name: p.name,
    description: p.values.join(', ') || '(no values)',
  }))

  const selectedParam = model.parameters[selectedParamIndex]

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Top row: params + values */}
      <box flexDirection="row" flexGrow={1}>
        {/* Parameters panel */}
        <box
          border
          borderStyle="single"
          borderColor={activePanel === 'params' || activePanel === 'adding' ? '#5fafff' : '#444444'}
          title=" Parameters "
          titleAlignment="left"
          width="35%"
          flexDirection="column"
        >
          {activePanel === 'adding' && (
            <box paddingX={1} backgroundColor="#1a2a4a">
              <box flexDirection="row" gap={1} alignItems="center">
                <text fg="#5fafff">New:</text>
                <input
                  value={newParamName}
                  onChange={onNewParamNameChange}
                  focused
                  placeholder="param name..."
                  backgroundColor="#1a2a4a"
                  focusedBackgroundColor="#2a3a5a"
                />
              </box>
            </box>
          )}
          {paramOptions.length > 0 ? (
            <select
              options={paramOptions}
              selectedIndex={selectedParamIndex}
              onChange={(index) => onParamNavigate(index)}
              focused={activePanel === 'params'}
              showScrollIndicator
              flexGrow={1}
            />
          ) : (
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text fg="#666666">No parameters{'\n'}Press [a] to add</text>
            </box>
          )}
        </box>

        {/* Values panel */}
        <box
          border
          borderStyle="single"
          borderColor={activePanel === 'values' ? '#5fafff' : '#444444'}
          title={selectedParam ? ` Values: ${selectedParam.name} ` : ' Values '}
          titleAlignment="left"
          flexGrow={1}
          flexDirection="column"
          padding={1}
        >
          {selectedParam ? (
            <>
              <text fg="#888888">Comma-separated values:</text>
              <input
                value={valuesInput}
                onChange={onValuesChange}
                focused={activePanel === 'values'}
                placeholder="value1, value2, value3..."
                backgroundColor="#1a1a2e"
                focusedBackgroundColor="#1a2a4a"
              />
              <box marginTop={1}>
                <text fg="#666666">
                  {selectedParam.values.length} value{selectedParam.values.length !== 1 ? 's' : ''}
                  {selectedParam.values.length > 0 && ': '}
                  {selectedParam.values.map((v, i) => (
                    <span key={i}>
                      {i > 0 && <span fg="#444444">, </span>}
                      <span fg="#aaffaa">{v}</span>
                    </span>
                  ))}
                </text>
              </box>
            </>
          ) : (
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <text fg="#666666">Select a parameter to edit values</text>
            </box>
          )}
        </box>
      </box>

      {/* Constraints panel */}
      <box
        border
        borderStyle="single"
        borderColor={activePanel === 'constraints' ? '#5fafff' : '#444444'}
        title=" Constraints "
        titleAlignment="left"
        height={8}
        padding={1}
      >
        <textarea
          key={constraintsKey}
          ref={constraintsRef}
          initialValue={model.constraints}
          focused={activePanel === 'constraints'}
          placeholder={'IF [Param] = "Value" THEN [OtherParam] <> "OtherValue";'}
          wrapMode="word"
          flexGrow={1}
        />
      </box>
    </box>
  )
}
