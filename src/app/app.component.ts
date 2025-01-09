import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NseDataService } from './services/nse-data.service';
import { allRecords, Daum, FilterObj, FormData, NseDataSet, ScannerModel, ScannerResponse, timeData, timeDataRecords, TypeFlag } from './app.model';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  data: NseDataSet[] = [];
  scannerData: Daum[] = [];
  displayedColumns: string[] | undefined = undefined;
  displayedColumnsGainer = ['exch', 'sym', 'disp', 'ltp', 'sl', 'chng', 'pchng', 'openHigh', 'openLow'];
  displayedColumnsLoser = ['exch', 'sym', 'disp', 'ltp', 'sl', 'chng', 'pchng', 'lastHigh', 'lastLow'];
  dataSource = new MatTableDataSource();
  refreshDateTime: Date | undefined;
  nextRefresh: Date | undefined;
  timeDataRecords: timeDataRecords | undefined;
  timeDataRecordsAll: allRecords[] = [];

  formData: FormData = {
    ChangeInPerFrom: 0,
    ChangeInPerTo: 0,
    StockName: ''
  }

  private intervalId!: ReturnType<typeof setInterval>; // For clearing the interval
  private timeoutId!: ReturnType<typeof setTimeout>; // For clearing the timeout
  private intervalIdForStockCall!: ReturnType<typeof setInterval>; // For clearing the interval

  constructor(private nseDataService: NseDataService) { }

  filterObj: FilterObj | undefined;

  selectedList = TypeFlag.Gainer;
  showMeGreen = true;
  showMeRed = true;
  timeInterval = 15;
  noOfRecords = 50;
  budget = 10000;

  ngOnInit() {
    const storageData = localStorage.getItem("timerecords");
    const isPastData = storageData ? JSON.parse(storageData).createdData == new Date(Date.now()).toDateString() : false;

    if (isPastData) {
      localStorage.removeItem("timerecords");
    }
    this.scheduleNextExecution();
  }

  getFilterObj(typeFlag: TypeFlag): FilterObj {
    return {
      Seg: 1,
      SecIdxCode: 19,
      Count: this.noOfRecords,
      TypeFlag: typeFlag,
      DayLevelIndicator: 1,
      ExpCode: -1,
      Instrument: "EQUITY"
    }
  }

  getDataForGainer() {
    this.selectedList = TypeFlag.Gainer;
    this.displayedColumns = this.displayedColumnsGainer;

    this.filterObj = this.getFilterObj(TypeFlag.Gainer);
    if (!this.filterObj) {
      return;
    }
    this.nseDataService.getNseData(this.filterObj).subscribe({
      next: async (response) => {
        this.refreshDateTime = new Date();
        this.data = response.data;
        this.dataSource.data = await Promise.all(this.data.map(async x => this.getTimeData(x)));;
        this.filterData();
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  getDataForLosers() {
    this.displayedColumns = this.displayedColumnsLoser;
    this.selectedList = TypeFlag.Loser;
    this.filterObj = this.getFilterObj(TypeFlag.Loser);
    if (!this.filterObj) {
      return;
    }
    this.nseDataService.getNseData(this.filterObj).subscribe({
      next: (response) => {
        this.refreshDateTime = new Date();
        this.data = response.data;
        this.dataSource.data = this.data.map(async x => await this.getTimeData(x));


        this.filterData();
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  refreshData() {
    if (!this.intervalIdForStockCall) {
      this.intervalIdForStockCall = setInterval(() => {
        this.refreshData();
      }, 1 * 60 * 1000); // 15 minutes in milliseconds
    }

    if (this.selectedList == TypeFlag.Gainer) {
      this.getDataForGainer10EMA();

    }
    else {
      //this.getDataForLosers();
    }
  }

  filterData() {
    let filterData: NseDataSet[] = [];
    let isFilterData = false;
    if (this.formData.StockName && this.formData.StockName.length > 0) {
      filterData = this.data.filter(x => x.sym.toLowerCase().includes(this.formData.StockName.toLowerCase()) || x.disp.toLowerCase().includes(this.formData.StockName.toLowerCase()));
      isFilterData = true;
    }

    if (this.formData.ChangeInPerTo > this.formData.ChangeInPerFrom) {
      filterData = filterData = filterData && filterData.length > 0 ? filterData.filter(x => Math.abs(x.pchng) >= this.formData.ChangeInPerFrom && Math.abs(x.pchng) <= this.formData.ChangeInPerTo) : this.data.filter(x => Math.abs(x.pchng) >= this.formData.ChangeInPerFrom && Math.abs(x.pchng) <= this.formData.ChangeInPerTo);
      isFilterData = true;
    }

    if (this.selectedList == TypeFlag.Gainer) {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.ltp > x.openHigh) : this.data.filter(x => x.ltp > x.openHigh);
    }
    else {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.ltp < x.openLow) : this.data.filter(x => x.ltp < x.openLow);
    }

    if (isFilterData) {
      this.dataSource.data = filterData;
    }
    else {
      this.dataSource.data = this.data;
    }
  }

  async getTimeData(dataObj: NseDataSet) {
    this.calculateSL(dataObj);
    this.timeDataRecordsAll = [];

    this.timeDataRecordsAll = this.getLocalStorage();

    const timeDataFound = this.timeDataRecordsAll.find(x => x.sid == dataObj.sid && x.lastUpdatedOn == this.nextRefresh);

    if (timeDataFound) {
      this.timeDataRecords = timeDataFound.timeDataRecords;
      dataObj.openHigh = this.timeDataRecords?.h[0] ?? 0;
      dataObj.openLow = this.timeDataRecords?.l[0] ?? 0;
      dataObj.lastHigh = this.timeDataRecords?.h[this.timeDataRecords?.l.length - 1] ?? 0;
      dataObj.lastLow = this.timeDataRecords?.l[this.timeDataRecords?.l.length - 1] ?? 0;
      return;
    }

    let timeData: timeData = {
      END: Math.floor(new Date(new Date().setHours(16, 0, 0, 0)).getTime() / 1000),
      END_TIME: new Date(new Date().setHours(16, 0, 0, 0)).toString(),
      EXCH: "NSE",
      INST: "EQUITY",
      INTERVAL: this.timeInterval.toString(),
      SEC_ID: dataObj.sid,
      SEG: "E",
      START: Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000),
      START_TIME: new Date(new Date().setHours(0, 0, 0, 0)).toString(),
    }

    await this.nseDataService.getTimeData(timeData).subscribe({
      next: (response) => {
        this.timeDataRecords = response.data;
        if (this.timeDataRecords) {
          dataObj.openHigh = this.timeDataRecords.h[0] ?? 0;
          dataObj.openLow = this.timeDataRecords.l[0] ?? 0;
          dataObj.lastHigh = this.timeDataRecords.h[this.timeDataRecords.l.length - 1] ?? 0;
          dataObj.lastLow = this.timeDataRecords.l[this.timeDataRecords.l.length - 1] ?? 0;

          this.timeDataRecordsAll.push({
            sid: dataObj.sid,
            timeDataRecords: this.timeDataRecords,
            lastUpdatedOn: this.nextRefresh?.toString()
          })

          this.setLocalStorage();
        }
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  scheduleNextExecution(): void {
    // Clear both timeout and interval when the component is destroyed
    clearTimeout(this.timeoutId);
    clearInterval(this.intervalId);

    //call first time
    this.refreshData();
    const now = new Date();
    const nextExecutionTime = this.getNextExecutionTime(now);
    const delay = nextExecutionTime.getTime() - now.getTime();

    this.nextRefresh = nextExecutionTime;
    this.startInterval(); // Start the regular interval
    // Schedule the first call using setTimeout
    this.timeoutId = setTimeout(() => {
      this.refreshData(); // Execute the method
      this.startInterval(); // Start the regular interval
    }, delay);
  }

  private getNextExecutionTime(currentTime: Date): Date {
    const nextExecution = new Date(currentTime);
    const minutes = nextExecution.getMinutes();

    // Calculate the next 15-minute interval
    const nextInterval = Math.ceil(minutes / this.timeInterval) * this.timeInterval;
    nextExecution.setMinutes(nextInterval, 0, 0);

    // If the calculated time is in the past, move to the next hour
    if (nextExecution <= currentTime) {
      nextExecution.setHours(nextExecution.getHours(), nextExecution.getMinutes() + this.timeInterval, 0, 0);
    }
    this.nextRefresh = nextExecution;
    return nextExecution;
  }

  private startInterval(): void {
    // Schedule the method to execute every 15 minutes
    this.intervalId = setInterval(() => {
      const now = new Date();
      this.getNextExecutionTime(now);
      this.refreshData();
    }, this.timeInterval * 60 * 1000); // 15 minutes in milliseconds
  }

  private calculateSL(dataObj: NseDataSet) {
    dataObj.intradayQty = Math.round(this.budget / (dataObj.ltp / 5));

    const closePrice: number = dataObj.ltp - dataObj.chng;
    const points = closePrice * (1.45 / 100);
    if (this.selectedList == TypeFlag.Gainer) {
      dataObj.StopLoss = closePrice + points;
    }
    else {
      dataObj.StopLoss = closePrice - points;
    }
  }

  private setLocalStorage() {
    const localStorageObj = {
      createdData: new Date(Date.now()).toDateString(),
      timeRecords: this.timeDataRecordsAll
    }
    localStorage.setItem("timerecords", JSON.stringify(localStorageObj));
  }

  private getLocalStorage() {
    const storageData = localStorage.getItem("timerecords");
    return storageData ? JSON.parse(storageData).timeRecords : [];
  }


  //Get gainer data according to scanner
  getDataForGainer10EMA() {
    this.selectedList = TypeFlag.Gainer;
    this.nseDataService.getGainer10EMA(this.getScannerModel(50)).subscribe({
      next: async (response: ScannerResponse) => {
        console.log(response);
        this.refreshDateTime = new Date();
        this.scannerData = response.data;
        this.dataSource.data = await Promise.all(this.scannerData.map(async x => this.getTimeDataScanner(x)));;
        this.filterDataScanner();
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  getScannerModel(count: number): ScannerModel {
    return {
      "sort": "PPerchange",
      "sorder": "desc",
      "count": count,
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
        "PPerchange",
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

  async getTimeDataScanner(dataObj: Daum) {
    this.calculateSLScanner(dataObj);
    this.timeDataRecordsAll = [];

    this.timeDataRecordsAll = this.getLocalStorage();

    const timeDataFound = this.timeDataRecordsAll.find(x => x.sid == dataObj.Sid && x.lastUpdatedOn == this.nextRefresh);

    if (timeDataFound) {
      this.timeDataRecords = timeDataFound.timeDataRecords;
      dataObj.openHigh = this.timeDataRecords?.h[0] ?? 0;
      dataObj.openLow = this.timeDataRecords?.l[0] ?? 0;
      dataObj.lastHigh = this.timeDataRecords?.h[this.timeDataRecords?.l.length - 1] ?? 0;
      dataObj.lastLow = this.timeDataRecords?.l[this.timeDataRecords?.l.length - 1] ?? 0;
      return;
    }

    let timeData: timeData = {
      END: Math.floor(new Date(new Date().setHours(16, 0, 0, 0)).getTime() / 1000),
      END_TIME: new Date(new Date().setHours(16, 0, 0, 0)).toString(),
      EXCH: "NSE",
      INST: "EQUITY",
      INTERVAL: this.timeInterval.toString(),
      SEC_ID: dataObj.Sid,
      SEG: "E",
      START: Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000),
      START_TIME: new Date(new Date().setHours(0, 0, 0, 0)).toString(),
    }

    await this.nseDataService.getTimeData(timeData).subscribe({
      next: (response) => {
        this.timeDataRecords = response.data;
        if (this.timeDataRecords) {
          dataObj.openHigh = this.timeDataRecords.h[0] ?? 0;
          dataObj.openLow = this.timeDataRecords.l[0] ?? 0;
          dataObj.lastHigh = this.timeDataRecords.h[this.timeDataRecords.l.length - 1] ?? 0;
          dataObj.lastLow = this.timeDataRecords.l[this.timeDataRecords.l.length - 1] ?? 0;

          this.timeDataRecordsAll.push({
            sid: dataObj.Sid,
            timeDataRecords: this.timeDataRecords,
            lastUpdatedOn: this.nextRefresh?.toString()
          })

          this.setLocalStorage();
        }
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  filterDataScanner() {
    let filterData: Daum[] = [];
    let isFilterData = false;
    if (this.formData.StockName && this.formData.StockName.length > 0) {
      filterData = this.scannerData.filter(x => x.Sym.toLowerCase().includes(this.formData.StockName.toLowerCase()) || x.DispSym.toLowerCase().includes(this.formData.StockName.toLowerCase()));
      isFilterData = true;
    }

    if (this.formData.ChangeInPerTo > this.formData.ChangeInPerFrom) {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => Math.abs(x.PPerchange) >= this.formData.ChangeInPerFrom && Math.abs(x.PPerchange) <= this.formData.ChangeInPerTo) :
        this.scannerData.filter(x => Math.abs(x.PPerchange) >= this.formData.ChangeInPerFrom && Math.abs(x.PPerchange) <= this.formData.ChangeInPerTo);
      isFilterData = true;
    }

    if (this.selectedList == TypeFlag.Gainer) {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.Ltp > x.openHigh) : this.scannerData.filter(x => x.Ltp > x.openHigh);
    }
    else {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.Ltp < x.openLow) : this.scannerData.filter(x => x.Ltp < x.openLow);
    }

    if (isFilterData) {
      this.dataSource.data = filterData;
    }
    else {
      this.dataSource.data = this.scannerData;
    }
  }

  private calculateSLScanner(dataObj: Daum) {
    dataObj.intradayQty = Math.round(this.budget / (dataObj.Ltp / 5));

    const closePrice: number = dataObj.Ltp - dataObj.Pchange;
    const points = closePrice * (1.45 / 100);
    if (this.selectedList == TypeFlag.Gainer) {
      dataObj.StopLoss = closePrice + points;
    }
    else {
      dataObj.StopLoss = closePrice - points;
    }
  }

  ngOnDestroy(): void {
    // Clear both timeout and interval when the component is destroyed
    clearTimeout(this.timeoutId);
    clearInterval(this.intervalId);
  }
}