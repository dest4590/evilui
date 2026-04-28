import {Component, OnInit, OnDestroy, ViewChild} from '@angular/core';
import { SortService, ColumnSortedEvent } from '../../services/sort.service';
import { ApiService } from '../../services/api.service';
import { Host } from '../../models/host';
import { OmniBarService } from '../../services/omnibar.service';
import { ClipboardService } from '../../services/clipboard.service';

declare var $: any;

@Component({
    selector: 'ui-lan-table',
    standalone: false,
    templateUrl: './lan-table.component.html',
    styleUrls: ['./lan-table.component.scss']
})
export class LanTableComponent implements OnInit, OnDestroy {
    hosts: Host[] = [];

    isSpoofing: boolean = false;
    viewSpoof: boolean = false;
    spoofList: any = {};
    lastSpoofHostIndex: number = -1;
    spoofOpts: any = {
        targets: '',
        whitelist: '',
        fullduplex: false,
        internal: false,
        gratuitous: false,
        random: false,
        verbose: false,
        interval: 1,
        ban: false
    };

    scanState: any = {
        scanning: [],
        progress: 0.0
    };

    iface: Host | null = null;
    gateway: Host | null = null;
    sort: ColumnSortedEvent;
    sortSub: any;

    visibleMeta = null;
    visibleMenu = null;

    constructor(private api: ApiService, private sortService: SortService, public omnibar: OmniBarService, public clipboard: ClipboardService) { 
        this.sort = {field: 'ipv4', type:'ip', direction: 'desc'};
        this.update(this.api.session);
    }

    ngOnInit() {
        this.api.onNewData.subscribe((session: any) => {
            this.update(session);
        });

        this.sortSub = this.sortService.onSort.subscribe((event: ColumnSortedEvent) => {
            this.sort = event;
            this.sortService.sort(this.hosts, event);
        });
    }

    ngOnDestroy() {
        this.sortSub.unsubscribe();
    }

    isSpoofed(host : any) : boolean {
        return (host.ipv4 in this.spoofList);
    }

    private updateSpoofOpts() {
        this.spoofOpts.targets = Object.keys(this.spoofList).join(', ');
    }

    private resetSpoofOpts() {
        this.spoofOpts = {
            targets: this.api.session.env.data['arp.spoof.targets'],
            whitelist: this.api.session.env.data['arp.spoof.whitelist'],
            fullduplex: this.api.session.env.data['arp.spoof.fullduplex'].toLowerCase() == 'true',
            internal: this.api.session.env.data['arp.spoof.internal'].toLowerCase() == 'true',
            gratuitous: this.api.session.env.data['arp.spoof.gratuitous'].toLowerCase() == 'true',
            random: this.api.session.env.data['arp.spoof.random'].toLowerCase() == 'true',
            verbose: this.api.session.env.data['arp.spoof.verbose'] ? this.api.session.env.data['arp.spoof.verbose'].toLowerCase() == 'true' : false,
            interval: parseInt(this.api.session.env.data['arp.spoof.interval']),
            ban: false
        };
    }

    hideSpoofMenu() {
        this.viewSpoof = false; 
        this.resetSpoofOpts();
    }

    showSpoofMenuFor( host : Host, add : boolean ) {
        if( add )
            this.spoofList[host.ipv4] = true;
        else
            delete this.spoofList[host.ipv4];

        this.updateSpoofOpts();
        this.visibleMenu = null; 
        this.viewSpoof = true;
    }

    private getFilteredHosts(): Host[] {
        const term = String(this.omnibar.query || '');
        if (term.length < 3)
            return this.hosts;

        const needle = term.toLowerCase();
        return this.hosts.filter(host => JSON.stringify(host).toLowerCase().includes(needle));
    }

    onSpoofCheckboxClick(event: MouseEvent, host: Host, index: number) {
        const checkbox = event.target as HTMLInputElement;
        const checked = checkbox.checked;
        const visibleHosts = this.getFilteredHosts();
        const currentIndex = index;

        if (event.shiftKey && this.lastSpoofHostIndex >= 0 && visibleHosts.length > 0) {
            const start = Math.min(this.lastSpoofHostIndex, currentIndex);
            const end = Math.max(this.lastSpoofHostIndex, currentIndex);

            for (let i = start; i <= end; i++) {
                const rangeHost = visibleHosts[i];
                if (!rangeHost || rangeHost == this.iface || rangeHost == this.gateway)
                    continue;

                if (checked)
                    this.spoofList[rangeHost.ipv4] = true;
                else
                    delete this.spoofList[rangeHost.ipv4];
            }
        } else {
            if (checked)
                this.spoofList[host.ipv4] = true;
            else
                delete this.spoofList[host.ipv4];
        }

        this.lastSpoofHostIndex = currentIndex;
        this.updateSpoofOpts();
    }

    updateSpoofingList() {
        let newSpoofList = this.spoofList;

        $('.spoof-toggle').each((i: number, toggle: any) => {
            let $toggle = $(toggle);
            let ip = $toggle.attr('data-ip');
            if( $toggle.is(':checked') ) {
                newSpoofList[ip] = true;
            } else {
                delete newSpoofList[ip];
            }
        });

        this.spoofList = newSpoofList;
        this.updateSpoofOpts();
    }

    onSpoofStart() {
        if( this.isSpoofing && !confirm("This will unspoof the current targets, set the new parameters and restart the module. Continue?") )
            return;

        this.api.cmd('set arp.spoof.targets ' + (this.spoofOpts.targets == "" ? '""' : this.spoofOpts.targets));
        this.api.cmd('set arp.spoof.whitelist ' + (this.spoofOpts.whitelist == "" ? '""' : this.spoofOpts.whitelist));
        this.api.cmd('set arp.spoof.fullduplex ' + this.spoofOpts.fullduplex);
        this.api.cmd('set arp.spoof.internal ' + this.spoofOpts.internal);
        this.api.cmd('set arp.spoof.gratuitous ' + this.spoofOpts.gratuitous);
        this.api.cmd('set arp.spoof.random ' + this.spoofOpts.random);
        this.api.cmd('set arp.spoof.verbose ' + this.spoofOpts.verbose);
        this.api.cmd('set arp.spoof.interval ' + this.spoofOpts.interval);

        let onCmd = this.spoofOpts.ban ? 'arp.ban on' : 'arp.spoof on';
        
        if( this.isSpoofing ) {
            this.api.cmd('arp.spoof off; ' + onCmd);
        }
        else {
            this.api.cmd(onCmd);
        }

        this.viewSpoof = false;
        this.resetSpoofOpts();
    }

    onSpoofOnce() {
        this.api.cmd('set arp.spoof.targets ' + (this.spoofOpts.targets == "" ? '""' : this.spoofOpts.targets));
        this.api.cmd('set arp.spoof.whitelist ' + (this.spoofOpts.whitelist == "" ? '""' : this.spoofOpts.whitelist));
        this.api.cmd('set arp.spoof.fullduplex ' + this.spoofOpts.fullduplex);
        this.api.cmd('set arp.spoof.internal ' + this.spoofOpts.internal);
        this.api.cmd('arp.spoof once');
        this.viewSpoof = false;
        this.resetSpoofOpts();
    }

    private update(session: any) {
        const ipRe = /^(?=.*[^\.]$)((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.?){4}$/;

        let spoofing = this.api.session.env.data['arp.spoof.targets']
            // split by comma and trim spaces
            .split(',')
            .map((s: string) => s.trim())
            // remove empty elements
            .filter(s => s.length);

        const arpSpoofModule = this.api.module('arp.spoof');
        this.isSpoofing = arpSpoofModule && arpSpoofModule.running ? true : false;
        const synScanModule = this.api.module('syn.scan');
        this.scanState = synScanModule && synScanModule.state ? synScanModule.state : { scanning: [], progress: 0.0 };

        // freeze the interface while the user is doing something
        if( this.viewSpoof || ($('.menu-dropdown') && $('.menu-dropdown').length > 0 && $('.menu-dropdown').is(':visible')) )
            return;
        
        this.resetSpoofOpts();
        this.spoofList = {};
        // if there are elements that are not IP addresses, it means the user
        // has set the variable manually, which overrides the UI spoof list.
        for( let i = 0; i < spoofing.length; i++ ) {
            if( ipRe.test(spoofing[i]) ) {
               this.spoofList[spoofing[i]] = true; 
            } else {
                this.spoofList = {};
                break;
            }
        }

        this.iface = session.interface;
        this.gateway = session.gateway;
        this.hosts = [];

        // if we `this.hosts` = session.lan['hosts'], pushing
        // to this.hosts will also push to the session object
        // duplicating the iface and gateway.
        for( var i = 0; i < session.lan['hosts'].length; i++ ){
            let host = session.lan['hosts'][i];
            // get traffic details for this host
            let sent = 0, received = 0;
            if( host.ipv4 in session.packets.traffic ) {
                let traffic = session.packets.traffic[host.ipv4];
                sent = traffic.sent;
                received = traffic.received;
            }

            host.sent = sent;
            host.received = received;

            this.hosts.push(host); 
        }

        if( this.iface && this.gateway && this.iface.mac == this.gateway.mac ) {
            this.hosts.push(this.iface);
        } else {
            if (this.iface) this.hosts.push(this.iface);
            if (this.gateway) this.hosts.push(this.gateway);
        }

        this.sortService.sort(this.hosts, this.sort)
    }

    setAlias(host: any) {
        $('#in').val(host.alias);
        $('#inhost').val(host.mac);
        $('#inputModalTitle').html('Set alias for ' + host.mac);
        $('#inputModal').modal('show');
    }

    doSetAlias() {
        $('#inputModal').modal('hide');

        let mac = $('#inhost').val();
        let alias = $('#in').val();

        if( alias.trim() == "" )
            alias = '""';

        this.api.cmd("alias " + mac + " " + alias);
    }

    showScannerModal(host: any) {
        $('#scanIP').val(host.ipv4);
        $('#startPort').val('1');
        $('#endPort').val('10000');
        $('#scanFast').prop('checked', false);
        $('#scanStealth').prop('checked', false);
        $('#scannerModal').modal('show');
    }

    doPortScan() {
        let ip = $('#scanIP').val();
        let startPort = $('#startPort').val();
        let endPort = $('#endPort').val();
        let fast = $('#scanFast').is(':checked');
        let stealth = $('#scanStealth').is(':checked');
        $('#scannerModal').modal('hide');

        this.api.cmd("set syn.scan.fast " + fast);
        this.api.cmd("set syn.scan.stealth " + stealth);
        this.api.cmd("syn.scan " + ip +" " + startPort + " " + endPort);
    }

    groupMetas(metas: any) {
        let grouped: any = {};
        for( let name in metas ) {
            let parts = name.split(':'),
                group = parts[0].toUpperCase(),
                sub = parts[1];

            if( group in grouped ) {
                grouped[group][sub] = metas[name];
            } else {
                grouped[group] = {};
                grouped[group][sub] = metas[name];
            }
        }
        // console.log("grouped", grouped);
        return grouped;
    }
}

