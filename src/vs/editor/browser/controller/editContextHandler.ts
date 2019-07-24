/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { ViewPart } from 'vs/editor/browser/view/viewPart';
import { ViewController } from 'vs/editor/browser/view/viewController';
import { ITextAreaHandlerHelper } from 'vs/editor/browser/controller/textAreaHandler';
import { AccessibilitySupport } from 'vs/platform/accessibility/common/accessibility';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { FastDomNode } from 'vs/base/browser/fastDomNode';
import { TextAreaInput } from 'vs/editor/browser/controller/textAreaInput';
import { ViewContext } from 'vs/editor/common/view/viewContext';
import { HorizontalRange, RestrictedRenderingContext, RenderingContext } from 'vs/editor/common/view/renderingContext';
import { Range } from 'vs/editor/common/core/range';
import { Position } from 'vs/editor/common/core/position';
import { Selection } from 'vs/editor/common/core/selection';
import { EndOfLinePreference } from 'vs/editor/common/model';
import * as viewEvents from 'vs/editor/common/view/viewEvents';
import { Emitter, Event } from 'vs/base/common/event';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

declare var EditContext: any;
declare var EditContextTextRange: any;

export class EditContextHandler extends ViewPart {

	private readonly _viewController: ViewController;
	private readonly _viewHelper: ITextAreaHandlerHelper;
	private _accessibilitySupport: AccessibilitySupport;
	private _contentLeft: number;
	private _contentWidth: number;
	private _contentHeight: number;
	private _scrollLeft: number;
	private _scrollTop: number;
	private _fontInfo: BareFontInfo;
	private _lineHeight: number;
	private _emptySelectionClipboard: boolean;
	private _copyWithSyntaxHighlighting: boolean;

	/**
	 * Defined only when the text area is visible (composition case).
	 */
	// private _visibleTextArea: VisibleTextAreaData | null;
	private _selections: Selection[];

	public readonly textArea: FastDomNode<HTMLTextAreaElement>;
	public readonly textAreaCover: FastDomNode<HTMLElement>;
	private readonly _textAreaInput: TextAreaInput;
	private readonly _editContext: any;
	private _containerDOM: HTMLElement;
	private _viewLineDomNode: HTMLElement;
	private _hasFocus: boolean;

	private _onFocus = this._register(new Emitter<void>());
	public readonly onFocus: Event<void> = this._onFocus.event;

	private _onBlur = this._register(new Emitter<void>());
	public readonly onBlur: Event<void> = this._onBlur.event;

	private _onKeyDown = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyDown: Event<IKeyboardEvent> = this._onKeyDown.event;

	private _onKeyUp = this._register(new Emitter<IKeyboardEvent>());
	public readonly onKeyUp: Event<IKeyboardEvent> = this._onKeyUp.event;

	constructor(context: ViewContext, viewController: ViewController, editContext: any) {
		super(context);

		this._viewController = viewController;
		this._editContext = editContext;

		this._hasFocus = false;
		const conf = this._context.configuration.editor;

		this._accessibilitySupport = conf.accessibilitySupport;
		this._contentLeft = conf.layoutInfo.contentLeft;
		this._contentWidth = conf.layoutInfo.contentWidth;
		this._contentHeight = conf.layoutInfo.contentHeight;
		this._scrollLeft = 0;
		this._scrollTop = 0;
		this._fontInfo = conf.fontInfo;
		this._lineHeight = conf.lineHeight;
		this._emptySelectionClipboard = conf.emptySelectionClipboard;
		this._copyWithSyntaxHighlighting = conf.copyWithSyntaxHighlighting;

		this._selections = [new Selection(1, 1, 1, 1)];

		const lineCnt = this._context.model.getLineCount();
		const maxColumnOfLastLine = this._context.model.getLineMaxColumn(lineCnt);
		const originalModelText = this._context.model.getValueInRange(new Range(1, 1, lineCnt, maxColumnOfLastLine), EndOfLinePreference.TextDefined);
		this._editContext.textChanged(/*insertAt*/0, /*charsToRemove*/0, originalModelText);
		this._editContext.selectionChanged(new EditContextTextRange(originalModelText.length, originalModelText.length));

		this._editContext.addEventListener('keydown', () => {
			console.log('keydown');
		});

		this._editContext.addEventListener('textupdate', ((e: any) => {
			const replaceCharCnt = e.updateRange.end - e.updateRange.start;

			const text = e.updateText;
			if (!this._selections[0].isEmpty()) {
				this._viewController.type('keyboard', text);
			} else {
				this._viewController.replacePreviousChar('keyboard', text, replaceCharCnt);
			}
		}).bind(this));
	}

	registerParent(info: { viewDomNode: HTMLElement, viewLineDomNode: HTMLElement }) {
		this._containerDOM = info.viewDomNode;
		this._viewLineDomNode = info.viewLineDomNode;

		console.log('register listener');
		this._register(dom.addStandardDisposableListener(this._viewLineDomNode, 'keydown', (e: IKeyboardEvent) => {
			console.log('keydown');
			// if (this._isDoingComposition &&
			// 	(e.keyCode === KeyCode.KEY_IN_COMPOSITION || e.keyCode === KeyCode.Backspace)) {
			// 	// Stop propagation for keyDown events if the IME is processing key input
			// 	e.stopPropagation();
			// }

			if (e.equals(KeyCode.Escape)) {
				// Prevent default always for `Esc`, otherwise it will generate a keypress
				// See https://msdn.microsoft.com/en-us/library/ie/ms536939(v=vs.85).aspx
				e.preventDefault();
			}
			this._viewController.emitKeyDown(e);
		}));

		this._register(dom.addStandardDisposableListener(this._viewLineDomNode, 'keyup', (e: IKeyboardEvent) => {
			this._viewController.emitKeyUp(e);
		}));
	}

	public onConfigurationChanged(e: viewEvents.ViewConfigurationChangedEvent): boolean {
		const conf = this._context.configuration.editor;

		if (e.fontInfo) {
			this._fontInfo = conf.fontInfo;
		}
		if (e.viewInfo) {
			this.textArea.setAttribute('aria-label', conf.viewInfo.ariaLabel);
		}
		if (e.layoutInfo) {
			this._contentLeft = conf.layoutInfo.contentLeft;
			this._contentWidth = conf.layoutInfo.contentWidth;
			this._contentHeight = conf.layoutInfo.contentHeight;
		}
		if (e.lineHeight) {
			this._lineHeight = conf.lineHeight;
		}
		if (e.accessibilitySupport) {
			this._accessibilitySupport = conf.accessibilitySupport;
			this._textAreaInput.writeScreenReaderContent('strategy changed');
		}
		if (e.emptySelectionClipboard) {
			this._emptySelectionClipboard = conf.emptySelectionClipboard;
		}
		if (e.copyWithSyntaxHighlighting) {
			this._copyWithSyntaxHighlighting = conf.copyWithSyntaxHighlighting;
		}

		return true;
	}

	public onCursorStateChanged(e: viewEvents.ViewCursorStateChangedEvent): boolean {
		this._selections = e.selections.slice(0);
		// this._textAreaInput.writeScreenReaderContent('selection changed');
		return true;
	}

	public onLinesChanged(e: viewEvents.ViewLinesChangedEvent): boolean {
		return true;
	}
	public onLinesDeleted(e: viewEvents.ViewLinesDeletedEvent): boolean {
		return true;
	}
	public onLinesInserted(e: viewEvents.ViewLinesInsertedEvent): boolean {
		return true;
	}

	public onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		this._scrollLeft = e.scrollLeft;
		this._scrollTop = e.scrollTop;
		return true;
	}
	public onZonesChanged(e: viewEvents.ViewZonesChangedEvent): boolean {
		return true;
	}

	public isFocused() {
		return true;
	}

	public focusEditContext(): void {
		this._setHasFocus(true);
		this._viewLineDomNode.focus();
		this._editContext.focus();
	}

	private _setHasFocus(newHasFocus: boolean): void {
		if (this._hasFocus === newHasFocus) {
			// no change
			return;
		}
		this._hasFocus = newHasFocus;

		if (this._hasFocus) {
			this._onFocus.fire();
		} else {
			this._onBlur.fire();
		}
	}

	private _primaryCursorVisibleRange: HorizontalRange | null = null;

	public prepareRender(ctx: RenderingContext): void {
		if (this._accessibilitySupport === AccessibilitySupport.Enabled) {
			// Do not move the textarea with the cursor, as this generates accessibility events that might confuse screen readers
			// See https://github.com/Microsoft/vscode/issues/26730
			this._primaryCursorVisibleRange = null;
		} else {
			const primaryCursorPosition = new Position(this._selections[0].positionLineNumber, this._selections[0].positionColumn);
			this._primaryCursorVisibleRange = ctx.visibleRangeForPosition(primaryCursorPosition);
		}
	}

	public render(ctx: RestrictedRenderingContext): void {
		if (!this._primaryCursorVisibleRange) {
			// The primary cursor is outside the viewport => place textarea to the top left
			// this._renderAtTopLeft();
			return;
		}

		const left = this._contentLeft + this._primaryCursorVisibleRange.left - this._scrollLeft;
		if (left < this._contentLeft || left > this._contentLeft + this._contentWidth) {
			// cursor is outside the viewport
			// this._renderAtTopLeft();
			return;
		}

		const top = this._context.viewLayout.getVerticalOffsetForLineNumber(this._selections[0].positionLineNumber) - this._scrollTop;
		if (top < 0 || top > this._contentHeight) {
			// cursor is outside the viewport
			// this._renderAtTopLeft();
			return;
		}

		const lineCnt = this._context.model.getLineCount();
		const maxColumnOfLastLine = this._context.model.getLineMaxColumn(lineCnt);
		const originalModelText = this._context.model.getValueInRange(new Range(1, 1, lineCnt, maxColumnOfLastLine), EndOfLinePreference.TextDefined);
		this._editContext.textChanged(/*insertAt*/0, /*charsToRemove*/0, originalModelText);

		const startOffset = this._context.model.getOffsetAt(this._selections[0].getStartPosition());
		const endOffset = this._context.model.getOffsetAt(this._selections[0].getEndPosition());
		this._editContext.selectionChanged(new EditContextTextRange(startOffset, endOffset));

		const viewRect = this._containerDOM.getBoundingClientRect() as DOMRect;
		const editControlRect = new DOMRect(
			/*x*/window.screenLeft + viewRect.x,
			/*y*/window.screenTop + viewRect.y,
			/*width*/viewRect.width,
			/*height*/viewRect.height);

		// console.log(editControlRect);
		const caretRect = new DOMRect(
			/*x*/editControlRect.x + viewRect.x + left,
			/*y*/editControlRect.y + viewRect.y + top,
			/*width*/10,
			/*height*/this._fontInfo.lineHeight
		);

		// console.log(caretRect);
		this._editContext.layoutChanged(editControlRect, caretRect);

	}
}