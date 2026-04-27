import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AlivePipe } from './alive.pipe';
import { ModIconPipe } from './modicon.pipe';
import { RecTimePipe } from './rectime.pipe';
import { SearchPipe } from './search.pipe';
import { SizePipe } from './size.pipe';
import { UnbashPipe } from './unbash.pipe';

const PIPES = [
    AlivePipe,
    ModIconPipe,
    RecTimePipe,
    SearchPipe,
    SizePipe,
    UnbashPipe,
];

@NgModule({
    declarations: PIPES,
    imports: [CommonModule],
    exports: PIPES
})
export class PipesModule { }
