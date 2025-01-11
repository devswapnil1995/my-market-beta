import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FilterObj, ScannerModel, timeData } from '../app.model';

@Injectable({
  providedIn: 'root'
})
export class NseDataService {
  private apiUrl = '/api/live-analysis-oi-spurts-underlyings'; // Proxy URL

  constructor(private http: HttpClient) { }

  getNseData(filterObj: FilterObj): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json, text/plain, */*',
      'content-type': 'application/json'
    });

    let data = {
      Data: filterObj
    }
    return this.http.post("https://scanx.dhan.co/scanx/daygnl", JSON.stringify(data), { headers });
  }

  getTimeData(timeData: timeData): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json, text/plain, */*',
      'content-type': 'application/json'
    });

    let data = timeData;
    return this.http.post("https://ticks.dhan.co/getData", JSON.stringify(data), { headers });
  }

  getGainer10EMA(scannerModel: ScannerModel): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json, text/plain, */*',
      'content-type': 'application/json'
    });

    let data = {
      data: scannerModel
    }
    return this.http.post("https://scanx-analytics.dhan.co/customscan/fetchdt", JSON.stringify(data), { headers });
  }
}
