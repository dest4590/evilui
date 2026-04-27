import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'search',
    standalone: false
})
export class SearchPipe implements PipeTransform {
    transform(values: any[], term: string): any[] {
        return values.filter((x: any) => {
            if (term.length < 3) return true;

            const lowerTerm = term.toLowerCase();
            for (const field in x) {
                const val = JSON.stringify(x[field]);
                if (val.toLowerCase().includes(lowerTerm)) {
                    return true;
                }
            }
            return false;
        });
    }
}
