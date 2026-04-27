import { Title } from '@angular/platform-browser';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from "@angular/router";
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from './services/api.service';
import { Session } from './models/session';

const POLLING_INTERVAL = 1000;

@Component({
    selector: 'ui-root',
    standalone: false,
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
    session: Session | null = null;

    private destroy$ = new Subject<void>();
    eventsSubscription: any;
    sessionSubscription: any;

    constructor(public api: ApiService, private router: Router, private titleService: Title) {
        this.api.onLoggedIn
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                console.log("logged in");
                this.session = this.api.session;
                this.sessionSubscription = this.api.pollSession().subscribe((session) => { this.session = session; });
                this.eventsSubscription = this.api.pollEvents().subscribe((events) => { });
            });

        this.api.onLoggedOut
            .pipe(takeUntil(this.destroy$))
            .subscribe(error => {
                console.log("logged out");

                this.session = null;

                if (this.sessionSubscription) {
                    this.sessionSubscription.unsubscribe();
                    this.sessionSubscription = null;
                }

                if (this.eventsSubscription) {
                    this.eventsSubscription.unsubscribe();
                    this.eventsSubscription = null;
                }

                this.router.navigateByUrl("/login");
            });
    }

    ngOnInit() {
        this.titleService.setTitle('evilcap');
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
