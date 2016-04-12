/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!../browser/media/mock.contribution';
import { InformationView } from 'vs/workbench/parts/mock/browser/mockViews';
import * as debug from 'vs/workbench/parts/debug/common/debug';

// Register mock debug views
debug.DebugViewRegistry.registerDebugView(InformationView, 25);
