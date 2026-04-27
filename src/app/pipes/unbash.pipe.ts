import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'unbash',
    standalone: false
})
export class UnbashPipe implements PipeTransform {
    // https://stackoverflow.com/questions/25245716/remove-all-ansi-colors-styles-from-strings
    // eslint-disable-next-line no-control-regex
    private readonly ansiPattern = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

    transform(data: string): string {
        return String(data).replace(this.ansiPattern, '');
    }
}
