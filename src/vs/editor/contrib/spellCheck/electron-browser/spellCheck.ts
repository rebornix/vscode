/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { editorContribution } from 'vs/editor/browser/editorBrowserExtensions';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { ISpellCheckService } from 'vs/workbench/parts/spellcheck/node/spellCheckService';
import Severity from 'vs/base/common/severity';
import { IMarker, IMarkerService } from 'vs/platform/markers/common/markers';
import { Position } from 'vs/editor/common/core/position';

class DiagnosticsModelLine {
	/**
	 * 1 based.
	 */
	private _lineNumber: number;
	public get lineNumber(): number { return this._lineNumber; }

	public diagnosticMarkers: IMarker[];

	constructor(lineNumber: number) {
		this._lineNumber = lineNumber | 1;
		this.diagnosticMarkers = [];
	}

	public updateLineNumber(lineNumber: number) {
		this._lineNumber = lineNumber;
		this.diagnosticMarkers.forEach((diagnosticMarker => {
			diagnosticMarker.startLineNumber = lineNumber;
			diagnosticMarker.endLineNumber = lineNumber;
		}));
	}
}

@editorContribution
export class SpellCheckController implements editorCommon.IEditorContribution {

	private static ID = 'editor.contrib.spellCheck';

	private _editor: ICodeEditor;
	private _toUnhook: IDisposable[];
	private _spellCheckService: ISpellCheckService;
	private _markerService: IMarkerService;
	private _diagnosticsModelLines: DiagnosticsModelLine[];
	private _diagnosticsMarkers: IMarker[];

	static get(editor: editorCommon.ICommonCodeEditor): SpellCheckController {
		return editor.getContribution<SpellCheckController>(SpellCheckController.ID);
	}

	constructor(editor: ICodeEditor,
		@ISpellCheckService spellCheckService: ISpellCheckService,
		@IMarkerService markerService: IMarkerService
	) {
		this._editor = editor;
		this._spellCheckService = spellCheckService;
		this._markerService = markerService;
		this._diagnosticsModelLines = null;

		this._toUnhook = [];
		this._toUnhook.push(this._editor.onDidChangeModelRawContent((e: editorCommon.IModelContentChangedEvent) => {
			this.updateDiagnostics(e);
		}));
		this._toUnhook.push(this._editor.onDidChangeModel(() => {
			this.calculateDiagnostics();
		}));
	}

	private updateDiagnostics(e: editorCommon.IModelContentChangedEvent) {
		if (this._spellCheckService.getSpellCheckers().length <= 0) {
			this._spellCheckService.createSpellChecker('en-US');
		}

		let spellCheckers = this._spellCheckService.getSpellCheckers();
		let model = this._editor.getModel();

		if (e.changeType === editorCommon.EventType.ModelRawContentChangedFlush) {
		} else if (e.changeType === editorCommon.EventType.ModelRawContentChangedLineChanged) {
			let changedLine = (<editorCommon.IModelContentChangedLineChangedEvent>e).lineNumber;
			let newContent = (<editorCommon.IModelContentChangedLineChangedEvent>e).detail;
			for (let i = 0, len = spellCheckers.length; i < len; i++) {
				let spellChecker = spellCheckers[i];
				spellChecker.checkSpellingAsync(newContent, (error, ranges) => {
					this._diagnosticsModelLines[changedLine - 1].diagnosticMarkers = [];
					for (let index = 0, rangeLen = ranges.length; index < rangeLen; index++) {
						let leftPos = new Position(changedLine, ranges[index].start + 1);
						let rightPos = new Position(changedLine, ranges[index].end + 1);

						let diagnosticMarker = {
							owner: 'spellchecker',
							resource: model.uri,
							severity: Severity.Warning,
							message: 'mispelled',
							startLineNumber: leftPos.lineNumber,
							startColumn: leftPos.column,
							endLineNumber: rightPos.lineNumber,
							endColumn: rightPos.column
						};

						this._diagnosticsModelLines[changedLine - 1].diagnosticMarkers.push(diagnosticMarker);
					}

					this._diagnosticsMarkers = [];
					this._diagnosticsModelLines.forEach(dia => {
						dia.diagnosticMarkers.forEach(marker => {
							this._diagnosticsMarkers.push(marker);
						});
					});
					this._markerService.changeOne('spellchecker', this._editor.getModel().uri, this._diagnosticsMarkers);
				});
			}
		} else if (e.changeType === editorCommon.EventType.ModelRawContentChangedLinesInserted) {
			let insertLine = (<editorCommon.IModelContentChangedLinesInsertedEvent>e).fromLineNumber;
			let insertedLinesCnt = (<editorCommon.IModelContentChangedLinesInsertedEvent>e).toLineNumber - insertLine + 1;
			let insertedModelLines: DiagnosticsModelLine[] = [];
			for (let j = insertLine - 1; j < insertLine + insertedLinesCnt - 1; j++) {
				insertedModelLines.push(new DiagnosticsModelLine(j));
			}

			this._diagnosticsModelLines.splice(insertLine - 2, 0, ...insertedModelLines);
			for (let i = insertLine + insertedLinesCnt - 1; i <= this._diagnosticsModelLines.length; i++) {
				this._diagnosticsModelLines[i - 1].updateLineNumber(i);
			}

			this._markerService.changeOne('spellchecker', this._editor.getModel().uri, this._diagnosticsMarkers);
		} else if (e.changeType === editorCommon.EventType.ModelRawContentChangedLinesDeleted) {
			let deleteLine1 = (<editorCommon.IModelContentChangedLinesDeletedEvent>e).fromLineNumber;
			let deleteLine2 = (<editorCommon.IModelContentChangedLinesDeletedEvent>e).toLineNumber;

			this._diagnosticsModelLines.splice(deleteLine1 - 1, deleteLine2 - deleteLine1 + 1);
			for (let i = deleteLine1; i <= this._diagnosticsModelLines.length; i++) {
				this._diagnosticsModelLines[i - 1].updateLineNumber(i);
			}

			this._diagnosticsMarkers = [];
			this._diagnosticsModelLines.forEach(dia => {
				dia.diagnosticMarkers.forEach(marker => {
					this._diagnosticsMarkers.push(marker);
				});
			});
			this._markerService.changeOne('spellchecker', this._editor.getModel().uri, this._diagnosticsMarkers);
		}
	}

	private calculateDiagnostics() {
		if (this._spellCheckService.getSpellCheckers().length <= 0) {
			this._spellCheckService.createSpellChecker('en-US');
		}

		let spellCheckers = this._spellCheckService.getSpellCheckers();
		let model = this._editor.getModel();

		if (!model) {
			return;
		}

		this._diagnosticsModelLines = [];

		for (let i = 1, len = model.getLineCount(); i <= len; i++) {
			this._diagnosticsModelLines.push(new DiagnosticsModelLine(i));
		}

		for (let i = 0, len = spellCheckers.length; i < len; i++) {
			let spellChecker = spellCheckers[i];
			let content = model.getLinesContent().join('\n');
			this._diagnosticsMarkers = [];
			spellChecker.checkSpellingAsync(content, (error, ranges) => {
				for (let index = 0, rangeLen = ranges.length; index < rangeLen; index++) {
					let leftPos = model.getPositionAt(ranges[index].start);
					let rightPos = model.getPositionAt(ranges[index].end);

					if (rightPos.lineNumber > leftPos.lineNumber) {
						rightPos = new Position(leftPos.lineNumber, model.getLineMaxColumn(leftPos.lineNumber));
					}

					let diagnosticMarker = {
						owner: 'spellchecker',
						resource: model.uri,
						severity: Severity.Warning,
						message: 'mispelled',
						startLineNumber: leftPos.lineNumber,
						startColumn: leftPos.column,
						endLineNumber: rightPos.lineNumber,
						endColumn: rightPos.column,
						startMarker: leftPos,
						endMarker: rightPos
					};

					this._diagnosticsMarkers.push(diagnosticMarker);
					this._diagnosticsModelLines[leftPos.lineNumber - 1].diagnosticMarkers.push(diagnosticMarker);
				}
				this._markerService.changeOne('spellchecker', this._editor.getModel().uri, this._diagnosticsMarkers);
			});
		}
	}

	public getId(): string {
		return SpellCheckController.ID;
	}

	public dispose(): void {
		this._toUnhook = dispose(this._toUnhook);
	}
}