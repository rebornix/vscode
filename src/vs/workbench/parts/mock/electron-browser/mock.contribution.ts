/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../browser/media/mock.contribution';
import { InformationView } from 'vs/workbench/parts/mock/browser/mockViews';
import * as debug from 'vs/workbench/parts/debug/common/debug';

// Register mock debug views.
// Use order 25 to put the information view between the watch and call stack view (which have orders 20 and 30 respectively).
debug.DebugViewRegistry.registerDebugView(InformationView, 25);
