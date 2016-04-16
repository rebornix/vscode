/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/terminal.contribution';
import nls = require('vs/nls');
import {KeyMod, KeyCode} from 'vs/base/common/keyCodes';
import platform = require('vs/platform/platform');
import {SyncActionDescriptor} from 'vs/platform/actions/common/actions';
import {registerSingleton} from 'vs/platform/instantiation/common/extensions';
import {IWorkbenchActionRegistry, Extensions as ActionExtensions} from 'vs/workbench/common/actionRegistry';
import {TerminalService} from 'vs/workbench/parts/terminal/node/terminalService';
import {ToggleTerminalAction} from 'vs/workbench/parts/terminal/node/terminalActions';
import {ITerminalService, TERMINAL_PANEL_ID} from 'vs/workbench/parts/terminal/common/terminal';
import panel = require('vs/workbench/browser/panel');

// Register Service
registerSingleton(ITerminalService, TerminalService);

// Register Output Panel
(<panel.PanelRegistry>platform.Registry.as(panel.Extensions.Panels)).registerPanel(new panel.PanelDescriptor(
	'vs/workbench/parts/terminal/node/terminalPanel',
	'TerminalPanel',
	TERMINAL_PANEL_ID,
	nls.localize('terminal', "Terminal"),
	'terminal'
));

// register toggle output action globally
let actionRegistry = <IWorkbenchActionRegistry>platform.Registry.as(ActionExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(ToggleTerminalAction, ToggleTerminalAction.ID, ToggleTerminalAction.LABEL, {
	primary: KeyMod.CtrlCmd | KeyCode.US_BACKTICK
}), nls.localize('viewCategory', "View"));
