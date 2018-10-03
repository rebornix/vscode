/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMonarchLanguage } from 'vs/editor/standalone/common/monarch/monarchTypes';
import { compile } from 'vs/editor/standalone/common/monarch/monarchCompile';
import { ITokenizationSupport } from 'vs/editor/common/modes';
import { createTokenizationSupport } from 'vs/editor/standalone/common/monarch/monarchLexer';
import { StaticServices } from 'vs/editor/standalone/browser/standaloneServices';

let _map: { [language: string]: ITokenizationSupport } = {};

export function registerLanguage(languageId: string, languageDef: IMonarchLanguage): void {
	let lexer = compile(languageId, languageDef);
	// todo, get rid of static services
	let adapter = createTokenizationSupport(StaticServices.modeService.get(), StaticServices.standaloneThemeService.get(), languageId, lexer);
	_map[languageId] = adapter;
}

export function getLanguageSupport(languageId: string) {
	return _map[languageId];
}