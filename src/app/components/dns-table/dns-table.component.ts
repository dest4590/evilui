import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { SortService, ColumnSortedEvent } from '../../services/sort.service';
import { OmniBarService } from '../../services/omnibar.service';
import { Event } from '../../models/event';

interface DnsEventRow {
    key: string;
    timestamp: number;
    time: string;
    activity: string;
    client: string;
    hostname: string;
    peer: string;
    website: string;
    details: string;
    raw: string;
    count: number;
}

@Component({
    selector: 'ui-dns-table',
    standalone: false,
    templateUrl: './dns-table.component.html',
    styleUrls: ['./dns-table.component.scss']
})
export class DnsTableComponent implements OnInit, OnDestroy {
    dnsEvents: DnsEventRow[] = [];
    private dnsEventMap: Map<string, DnsEventRow> = new Map<string, DnsEventRow>();
    private processedEventKeys: Set<string> = new Set<string>();
    modEnabled: boolean = false;
    sort: ColumnSortedEvent;
    subscriptions: any = [];

    constructor(private api: ApiService, private sortService: SortService, public omnibar: OmniBarService) {
        this.sort = { field: 'timestamp', direction: 'desc', type: '' };
        this.update(this.api.events);
    }

    ngOnInit() {
        this.subscriptions = [
            this.api.onNewEvents.subscribe((events: Event[]) => {
                this.update(events);
            }),
            this.sortService.onSort.subscribe((event: ColumnSortedEvent) => {
                this.sort = event;
                this.sortService.sort(this.dnsEvents, event);
            })
        ];
    }

    ngOnDestroy() {
        for (let i = 0; i < this.subscriptions.length; i++) {
            this.subscriptions[i].unsubscribe();
        }
        this.subscriptions = [];
    }

    private update(events: Event[]) {
        const mod = this.api.module('net.sniff');
        this.modEnabled = mod ? mod.running : false;

        const filtered = events.filter(e => e.tag === 'net.sniff.dns' || e.tag === 'net.sniff.https');
        filtered.forEach(event => this.addOrMergeEvent(event));

        this.dnsEvents = Array.from(this.dnsEventMap.values());
        this.sortService.sort(this.dnsEvents, this.sort);
    }

    private addOrMergeEvent(event: Event) {
        const processedKey = this.processedEventKey(event);
        if (this.processedEventKeys.has(processedKey)) {
            return;
        }

        this.processedEventKeys.add(processedKey);
        const row = this.toDnsEventRow(event);
        const groupKey = this.groupEventKey(row);

        if (this.dnsEventMap.has(groupKey)) {
            const existing = this.dnsEventMap.get(groupKey)!;
            existing.count += 1;
            if (row.timestamp > existing.timestamp) {
                existing.timestamp = row.timestamp;
                existing.time = row.time;
            }
            existing.details = row.details;
            existing.raw = row.raw;
        } else {
            this.dnsEventMap.set(groupKey, row);
        }
    }

    private processedEventKey(event: Event): string {
        const data = event.data || {};
        return [event.tag, event.time, data.from || '', data.to || '', this.stripAnsi(data.message || '')].join('::');
    }

    private groupEventKey(row: DnsEventRow): string {
        return [row.activity, row.client, row.hostname, row.peer, row.website, row.details].join('::');
    }

    private toDnsEventRow(event: Event): DnsEventRow {
        const data = event.data || {};
        const raw = this.stripAnsi(data.message || '');
        const packetTime = data.time || event.time;
        const base: DnsEventRow = {
            key: '',
            timestamp: new Date(packetTime).getTime(),
            time: packetTime,
            activity: event.tag === 'net.sniff.https' ? 'HTTPS' : 'DNS',
            client: data.from || '',
            hostname: this.resolveHostname(data.from || ''),
            peer: data.to || '',
            website: '',
            details: '',
            raw: raw,
            count: 1
        };

        if (event.tag === 'net.sniff.https') {
            const row = {
                ...base,
                client: data.from || '',
                peer: data.to || '',
                website: this.normalizeWebsite(data.to || this.extractSniHost(raw)),
                details: raw
            } as DnsEventRow;
            row.key = this.groupEventKey(row);
            return row;
        }

        const parsed = this.parseDnsMessage(raw);
        const clientIp = parsed.client || data.from || '';
        const row = {
            ...base,
            client: parsed.client || data.to || data.from || '',
            hostname: this.resolveHostname(clientIp),
            peer: parsed.resolver || data.from || data.to || '',
            website: parsed.website,
            details: parsed.answers,
            raw: raw
        } as DnsEventRow;
        row.key = this.groupEventKey(row);
        return row;
    }

    private parseDnsMessage(message: string) {
        const parsed = {
            client: '',
            resolver: '',
            website: '',
            answers: message
        };

        const match = message.match(/^dns\s+([^\s]+)\s+>\s+([^\s]+)\s+:\s+(.+?)\s+is\s+(.+)$/i);
        if (!match) {
            return parsed;
        }

        parsed.resolver = match[1];
        parsed.client = match[2];
        parsed.website = this.normalizeWebsite(match[3]);
        parsed.answers = match[4];

        return parsed;
    }

    private extractSniHost(message: string): string {
        const match = message.match(/^sni\s+[^\s]+\s+>\s+https:\/\/(.+)$/i);
        return match ? match[1] : '';
    }

    private normalizeWebsite(value: string): string {
        return String(value || '').replace(/^https:\/\//i, '').trim();
    }

    private resolveHostname(address: string): string {
        if (!address) {
            return '';
        }

        if (!this.api.session || !this.api.session.lan || !this.api.session.lan.hosts) {
            return '';
        }

        for (let host of this.api.session.lan.hosts) {
            if (host.ipv4 === address || host.ipv6 === address) {
                return host.hostname || host.alias || '';
            }
        }

        return '';
    }

    private stripAnsi(value: string): string {
        return String(value || '').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    }

    clear() {
        this.api.clearEvents();
        this.dnsEvents = [];
        this.dnsEventMap = new Map<string, DnsEventRow>();
        this.processedEventKeys = new Set<string>();
    }

    toggleModule() {
        const mod = this.api.module('net.sniff');
        let toggle = mod && mod.running ? 'off' : 'on';
        this.api.cmd("net.sniff " + toggle);
    }
}
