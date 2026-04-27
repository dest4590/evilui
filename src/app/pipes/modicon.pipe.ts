import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'modicon',
    standalone: false
})
export class ModIconPipe implements PipeTransform {
    transform(name: string): string {
        if (name === 'caplets') return 'scroll';
        if (name === 'hid') return 'keyboard';
        if (name === 'wifi') return 'wifi';
        if (name === 'gps') return 'globe';
        if (name === 'update') return 'download';
        if (name.indexOf('proxy') !== -1) return 'filter';
        if (name.indexOf('server') !== -1) return 'server';
        if (name.indexOf('recon') !== -1) return 'eye';
        if (name.indexOf('spoof') !== -1) return 'radiation';
        if (name.indexOf('net.') === 0) return 'network-wired';
        return 'tools';
    }
}
