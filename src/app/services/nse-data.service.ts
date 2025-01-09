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
      "data": {
        "sort": "PPerchange",
        "sorder": "desc",
        "count": 50,
        "params": [
          {
            "field": "Exch",
            "op": "",
            "val": "NSE"
          },
          {
            "field": "idxlist.Indexid",
            "op": "",
            "val": "19,13,25"
          },
          {
            "field": "PPerchange",
            "op": "RANGE",
            "val": "2_38.74"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "OgInst",
            "op": "",
            "val": "ES"
          },
          {
            "field": "Volume",
            "op": "gte",
            "val": "0"
          }
        ],
        "fields": [
          "DispSym",
          "Ltp",
          "Pchange",
          "PPerchange",
          "Volume",
          "Pe",
          "Mcap",
          "PricePerchng1week",
          "YearlyRevenue",
          "FIIHolding",
          "Min15EMA10CurrentCandle",
          "Sym"
        ],
        "pgno": 1
      }
    }
    return this.http.post("https://scanx-analytics.dhan.co/customscan/fetchdt", JSON.stringify(data), { headers });
  }
}
