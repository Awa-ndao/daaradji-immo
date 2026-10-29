import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from './config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = API_URL;

  constructor(private http: HttpClient) {}

  get(endpoint: string, params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key]) httpParams = httpParams.set(key, params[key]);
      });
    }
    return this.http.get(this.apiUrl + '/' + endpoint, { params: httpParams });
  }

  post(endpoint: string, data: any): Observable<any> {
    return this.http.post(this.apiUrl + '/' + endpoint, data);
  }

  put(endpoint: string, id: number, data: any): Observable<any> {
    return this.http.put(this.apiUrl + '/' + endpoint + '/' + id, data);
  }

  delete(endpoint: string, id: number): Observable<any> {
    return this.http.delete(this.apiUrl + '/' + endpoint + '/' + id);
  }
}