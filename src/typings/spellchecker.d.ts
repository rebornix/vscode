/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'spellchecker' {

    export function setDictionary(language: string, path: string): boolean;

    export function add(word: string): void;

    export function remove(word: string): void;

    export function isMisspelled(word: string): boolean;

    export function checkSpellingAsync(text: string, cb: (error: string, ranges: MisspelledRange[]) => void): void;

    export function getAvailableDictionaries(path: string): string[];

    export function getCorrectionsForMisspellingAsync(word: string, cb: (error: string, corrections: string[]) => void): void;

    interface MisspelledRange {

        start: number;

        end: number;

    }

    export class Spellchecker {

        setDictionary(language: string, path: string): boolean;

        add(word: string): void;

        remove(word: string): void;

        isMisspelled(word: string): boolean;

        checkSpellingAsync(text: string, cb: (error: string, ranges: MisspelledRange[]) => void): void;

        getAvailableDictionaries(path: string): string[];

        getCorrectionsForMisspellingAsync(word: string, cb: (error: string, corrections: string[]) => void): void;

    }

}