import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'alive',
    standalone: false
})
export class AlivePipe implements PipeTransform {
    transform(item: any, ms: number): boolean {
        const now = new Date().getTime();
        const seen = new Date(item.last_seen).getTime();
        return (now - seen) <= ms;
    }
}
