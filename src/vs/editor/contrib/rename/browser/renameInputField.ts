/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./renameInputField';
import { canceled } from 'vs/base/common/errors';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { Range } from 'vs/editor/common/core/range';
import { ContentWidgetPositionPreference, ICodeEditor, IContentWidget, IContentWidgetPosition } from 'vs/editor/browser/editorBrowser';
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
import { inputBackground, inputBorder, inputForeground, widgetShadow } from 'vs/platform/theme/common/colorRegistry';
import { Position } from 'vs/editor/common/core/position';
import * as React from 'react';
import * as ReactDom from 'react-dom';

export default class RenameInputField implements IContentWidget, IDisposable {

	private _editor: ICodeEditor;
	private _position: Position;
	private _domNode: HTMLElement;
	private _inputProps: any;
	private _inputFieldRef: any;
	private _visible: boolean;
	private _disposables: IDisposable[] = [];

	// Editor.IContentWidget.allowEditorOverflow
	public allowEditorOverflow: boolean = true;

	constructor(editor: ICodeEditor, @IThemeService private themeService: IThemeService) {
		this._editor = editor;
		this._editor.addContentWidget(this);

		this._disposables.push(editor.onDidChangeConfiguration(e => {
			if (e.fontInfo) {
				this.updateFont();
			}
		}));

		this._disposables.push(themeService.onThemeChange(theme => this.onThemeChange(theme)));
	}

	private onThemeChange(theme: ITheme): void {
		this.updateStyles(theme);
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
		this._editor.removeContentWidget(this);
	}

	public getId(): string {
		return '__renameInputWidget';
	}

	public getDomNode(): HTMLElement {
		if (!this._domNode) {
			this._inputProps = { 'style': {} };

			this._domNode = document.createElement('div');
			this._domNode.style.height = `${this._editor.getConfiguration().lineHeight}px`;
			this._domNode.className = 'monaco-editor rename-box';

			this.updateFont();
			this.updateStyles(this.themeService.getTheme());
		}
		return this._domNode;
	}

	private updateStyles(theme: ITheme): void {
		if (!this._inputProps) {
			return;
		}

		const background = theme.getColor(inputBackground);
		const foreground = theme.getColor(inputForeground);
		const widgetShadowColor = theme.getColor(widgetShadow);
		const border = theme.getColor(inputBorder);

		this._inputProps.style.backgroundColor = background ? background.toString() : null;
		this._inputProps.style.color = foreground ? foreground.toString() : null;

		this._inputProps.style.borderWidth = border ? '1px' : '0px';
		this._inputProps.style.borderStyle = border ? 'solid' : 'none';
		this._inputProps.style.borderColor = border ? border.toString() : 'none';

		this._domNode.style.boxShadow = widgetShadowColor ? ` 0 2px 8px ${widgetShadowColor}` : null;
	}

	private updateFont(): void {
		if (!this._inputProps) {
			return;
		}

		const fontInfo = this._editor.getConfiguration().fontInfo;
		this._inputProps.style.fontFamily = fontInfo.fontFamily;
		this._inputProps.style.fontWeight = fontInfo.fontWeight;
		this._inputProps.style.fontSize = `${fontInfo.fontSize}px`;
	}

	public getPosition(): IContentWidgetPosition {
		return this._visible
			? { position: this._position, preference: [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE] }
			: null;
	}

	private _currentAcceptInput: () => void = null;
	private _currentCancelInput: () => void = null;

	public acceptInput(): void {
		if (this._currentAcceptInput) {
			this._currentAcceptInput();
		}
	}

	public cancelInput(): void {
		if (this._currentCancelInput) {
			this._currentCancelInput();
		}
	}

	public getInput(where: Range, value: string, selectionStart: number, selectionEnd: number): TPromise<string> {
		this._position = new Position(where.startLineNumber, where.startColumn);
		this._inputProps.value = value;
		this._inputProps.selectionStart = selectionStart;
		this._inputProps.selectionEnd = selectionEnd;
		this._inputProps.size = Math.max((where.endColumn - where.startColumn) * 1.1, 20);

		let disposeOnDone: IDisposable[] = [],
			always: Function;

		always = () => {
			dispose(disposeOnDone);
			this._hide();
		};

		return new TPromise<string>((c, e) => {

			this._currentCancelInput = () => {
				this._currentAcceptInput = null;
				this._currentCancelInput = null;
				e(canceled());
				return true;
			};

			this._currentAcceptInput = () => {
				if (!this._inputFieldRef) {
					this.cancelInput();
					return;
				}

				if (this._inputFieldRef.value.trim().length === 0 || this._inputFieldRef.value === value) {
					// empty or whitespace only or not changed
					this.cancelInput();
					return;
				}

				this._currentAcceptInput = null;
				this._currentCancelInput = null;
				c(this._inputFieldRef.value);
			};

			let onCursorChanged = () => {
				if (!Range.containsPosition(where, this._editor.getPosition())) {
					this.cancelInput();
				}
			};

			disposeOnDone.push(this._editor.onDidChangeCursorSelection(onCursorChanged));
			disposeOnDone.push(this._editor.onDidBlurEditor(() => this.cancelInput()));

			this._show();

		}, this._currentCancelInput).then(newValue => {
			always();
			return newValue;
		}, err => {
			always();
			return TPromise.wrapError<string>(err);
		});
	}

	private _show(): void {
		this._editor.revealLineInCenterIfOutsideViewport(this._position.lineNumber);
		this._visible = true;
		this._editor.layoutContentWidget(this);

		setTimeout(() => {
			let elm = React.createElement('input', {
				type: 'text',
				className: 'rename-input',
				disabled: false,
				style: {
					backgroundColor: this._inputProps.style.backgroundColor,
					color: this._inputProps.style.color,
					fontSize: this._inputProps.style.fontSize,
					fontFamily: this._inputProps.style.fontFamily,
					borderWidth: this._inputProps.style.borderWidth,
					borderStyle: this._inputProps.style.borderStyle,
					borderColor: this._inputProps.style.borderColor
				},
				size: this._inputProps.size
			});
			this._inputFieldRef = ReactDom.render(elm, this._domNode);
			if (this._inputFieldRef.value !== this._inputProps.value) {
				this._inputFieldRef.value = this._inputProps.value;
			}
			this._inputFieldRef.focus();
			this._inputFieldRef.setSelectionRange(this._inputProps.selectionStart, this._inputProps.selectionEnd);

		}, 25);
	}

	private _hide(): void {
		this._visible = false;
		this._editor.layoutContentWidget(this);
	}
}
