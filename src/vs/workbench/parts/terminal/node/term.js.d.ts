/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'term.js' {
	function init(): TermJsTerminal;

	// TODO: No way to export this so it can be referenced outside of this file?
	interface TermJsTerminal {
		on(event: string, callback: (data: any) => void): void;
		resize(columns: number, rows: number): void;
	}

    export = init;
}