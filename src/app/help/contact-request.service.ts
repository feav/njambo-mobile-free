import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface ContactRequestPayload {
    fullName: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
}

export interface ContactRequestRecord extends ContactRequestPayload {
    id: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
    createdAt: string;
    updatedAt: string;
}

@Injectable({
    providedIn: 'root',
})
export class ContactRequestService {
    private readonly baseUrl = environment.apiBaseUrl;

    constructor(private http: HttpClient) {}

    submit(payload: ContactRequestPayload): Observable<{ contactRequest: ContactRequestRecord }> {
        return this.http.post<{ contactRequest: ContactRequestRecord }>(
            `${this.baseUrl}/contact-requests`,
            payload
        );
    }
}
