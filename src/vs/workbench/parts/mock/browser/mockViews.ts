/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import lifecycle = require('vs/base/common/lifecycle');
import dom = require('vs/base/browser/dom');
import actions = require('vs/base/common/actions');
import splitview = require('vs/base/browser/ui/splitview/splitview');
import debug = require('vs/workbench/parts/debug/common/debug');
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

const $ = dom.emmet;

export class InformationView extends splitview.CollapsibleView {

	private static MEMENTO = 'informationview.memento';
	private bodyContainer: HTMLElement;
	private toDispose: lifecycle.IDisposable[];

	// the view's model:
	private debugState: debug.State;
	private stackFrame: debug.IStackFrame;
	private currentFile: string;
	private currentLine: number;


	constructor(actionRunner: actions.IActionRunner, private settings: any,
		@ITelemetryService private telemetryService: ITelemetryService,
		@debug.IDebugService private debugService: debug.IDebugService
	) {
		super({
			minimumSize: 2 * 22,
			initialState: !!settings[InformationView.MEMENTO] ? splitview.CollapsibleState.COLLAPSED : splitview.CollapsibleState.EXPANDED,
			ariaHeaderLabel: nls.localize('information', "Information")
		});
		this.toDispose = [];

		// the following 'wireing' should probably go into a separate lifcycle hook.
		this.debugState = this.debugService.getState();

		const viewModel = this.debugService.getViewModel();
		this.toDispose.push(viewModel.addListener2(debug.ViewModelEvents.FOCUSED_STACK_FRAME_UPDATED, () => this.onFocusedStackFrameUpdated()));

		this.toDispose.push(this.debugService.addListener2(debug.ServiceEvents.STATE_CHANGED, () => this.onDebugStateChange()));
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = dom.append(container, $('div.title'));
		const titleSpan = dom.append(titleDiv, $('span.label'));
		titleSpan.textContent = nls.localize('information', "Information");
	}

	public renderBody(container: HTMLElement): void {
		dom.addClass(container, 'mock-information');
		this.bodyContainer = container;
		this.renderContent();
	}

	private onFocusedStackFrameUpdated(): void {
		this.stackFrame = this.debugService.getViewModel().getFocusedStackFrame();
		this.renderContent();
	}

	private onDebugStateChange(): void {

		this.debugState = this.debugService.getState();
		if (this.debugState === debug.State.Stopped) {
			let session = this.debugService.getActiveSession();
			if (session) {
				this.stackFrame = this.debugService.getViewModel().getFocusedStackFrame();
				session.custom('infoRequest', {}).then(response => {
					this.currentFile = response.body.currentFile;
					this.currentLine = response.body.currentLine;
					this.renderContent();
				});
			}
		} else {
			this.stackFrame = undefined;
			this.currentFile = undefined;
			this.currentLine = undefined;
			this.renderContent();
		}
	}

	private renderContent(): void {

		let content = `state: ${debug.State[this.debugState]}`;
		if (this.stackFrame) {
			content += `<br>frame: ${this.stackFrame.name}`;
		}
		if (this.currentFile) {
			content += `<br>file: ${this.currentFile}<br>line: ${this.currentLine}`;
		}
		this.bodyContainer.innerHTML = content;
	}

	public shutdown(): void {
		this.settings[InformationView.MEMENTO] = (this.state === splitview.CollapsibleState.COLLAPSED);
	}

	public dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
	}
}
