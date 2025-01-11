import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NseDataService } from './services/nse-data.service';
import { allRecords, Daum, FilterObj, FormData, GridList, NseDataSet, ScannerModel, ScannerResponse, timeData, timeDataRecords, TypeFlag } from './app.model';
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

  //Columns for gainers
  displayedColumnsGainer = ['StockName', 'DisplayName', 'LTP', 'IntradayQry', 'StopLoss', 'ChangeInPoint', 'ChangeInPer', 'OpenHigh', 'LastHigh'];

  //Columns for losers
  displayedColumnsLoser = ['StockName', 'DisplayName', 'LTP', 'IntradayQry', 'StopLoss', 'ChangeInPoint', 'ChangeInPer', 'OpenLow', 'LastLow'];

  gridList: GridList[] = [];
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


  refreshData() {
    if (!this.intervalIdForStockCall) {
      this.intervalIdForStockCall = setInterval(() => {
        this.refreshData();
      }, 1 * 60 * 1000); // 15 minutes in milliseconds
    }

    if (this.selectedList == TypeFlag.Gainer) {
      this.getDataForGainer();
    }
    else {
      this.getDataForLoser();
    }
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
  getDataForGainer() {
    this.selectedList = TypeFlag.Gainer;
    this.displayedColumns = this.displayedColumnsGainer;
    this.nseDataService.getGainer10EMA(this.getScannerModel(50)).subscribe({
      next: async (response: ScannerResponse) => {
        console.log(response);
        this.refreshDateTime = new Date();
        //mapp result received from API
        this.gridList = this.dataMapper(response.data);

        Promise.all(this.gridList.map(x => this.getTimeDataScanner(x)))
          .then((updatedList) => {
            this.dataSource.data = updatedList;
            this.filterDataScanner();
          })
          .catch((err) => {
            console.error("Error updating data source:", err);
          });
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }

  //Get loser data according to scanner
  getDataForLoser() {
    this.selectedList = TypeFlag.Loser;
    this.displayedColumns = this.displayedColumnsLoser;
    this.nseDataService.getGainer10EMA(this.getScannerModel(50)).subscribe({
      next: async (response: ScannerResponse) => {
        console.log(response);
        this.refreshDateTime = new Date();
        //mapp result received from API
        this.gridList = this.dataMapper(response.data);
        Promise.all(this.gridList.map(x => this.getTimeDataScanner(x)))
          .then((updatedList) => {
            this.dataSource.data = updatedList;
            this.filterDataScanner();
          })
          .catch((err) => {
            console.error("Error updating data source:", err);
          }); 
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
    });
  }


  //get model to send for API
  getScannerModel(count: number): ScannerModel {
    return {
      sort: "PPerchange",
      sorder: "desc",
      count: count,
      params: [
        {
          field: "Exch",
          op: "",
          val: "NSE"
        },
        {
          field: "idxlist.Indexid",
          op: "",
          val: "19,13,25"
        },
        {
          field: "PPerchange",
          op: "RANGE",
          val: this.selectedList == TypeFlag.Gainer ? "2_30" : "-35_-2"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "OgInst",
          op: "",
          val: "ES"
        },
        {
          field: "Volume",
          op: "gte",
          val: "0"
        }
      ],
      fields: [
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
      pgno: 1
    }
  }

  //Get 15 min data
  getTimeDataScanner(dataObj: GridList): Promise<GridList> {
    this.calculateSLScanner(dataObj);
    this.timeDataRecordsAll = this.getLocalStorage();

    const timeDataFound = this.timeDataRecordsAll.find(
      x => x.sid == dataObj.StockId && x.lastUpdatedOn == this.nextRefresh
    );

    if (timeDataFound) {
      this.timeDataRecords = timeDataFound.timeDataRecords;
      dataObj.OpenHigh = this.timeDataRecords?.h[0] ?? 0;
      dataObj.OpenLow = this.timeDataRecords?.l[0] ?? 0;
      dataObj.LastHigh = this.timeDataRecords?.h[this.timeDataRecords?.l.length - 1] ?? 0;
      dataObj.LastLow = this.timeDataRecords?.l[this.timeDataRecords?.l.length - 1] ?? 0;
      return Promise.resolve(dataObj);
    }

    const timeData: timeData = {
      END: Math.floor(new Date(new Date().setHours(16, 0, 0, 0)).getTime() / 1000),
      END_TIME: new Date(new Date().setHours(16, 0, 0, 0)).toString(),
      EXCH: "NSE",
      INST: "EQUITY",
      INTERVAL: this.timeInterval.toString(),
      SEC_ID: dataObj.StockId,
      SEG: "E",
      START:  Math.floor(new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000),
      START_TIME: new Date(new Date().setHours(0, 0, 0, 0)).toString(),
    };

    return new Promise((resolve, reject) => {
      this.nseDataService.getTimeData(timeData).subscribe({
        next: (response) => {
          this.timeDataRecords = response.data;
          if (this.timeDataRecords) {
            dataObj.OpenHigh = this.timeDataRecords.h[0] ?? 0;
            dataObj.OpenLow = this.timeDataRecords.l[0] ?? 0;
            dataObj.LastHigh = this.timeDataRecords.h[this.timeDataRecords.l.length - 1] ?? 0;
            dataObj.LastLow = this.timeDataRecords.l[this.timeDataRecords.l.length - 1] ?? 0;

            this.timeDataRecordsAll.push({
              sid: dataObj.StockId,
              timeDataRecords: this.timeDataRecords,
              lastUpdatedOn: this.nextRefresh?.toString(),
            });

            this.setLocalStorage();
          }
          resolve(dataObj);
        },
        error: (err) => {
          console.error("Error fetching data:", err);
          reject(err);
        },
      });
    });
  }

  //Filter the records
  filterDataScanner() {
    let filterData: GridList[] = [];
    let isFilterData = false;
    if (this.formData.StockName && this.formData.StockName.length > 0) {
      filterData = this.gridList.filter(x => x.StockName.toLowerCase().includes(this.formData.StockName.toLowerCase()) || x.DisplayName.toLowerCase().includes(this.formData.StockName.toLowerCase()));
      isFilterData = true;
    }

    if (this.formData.ChangeInPerTo > this.formData.ChangeInPerFrom) {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => Math.abs(x.ChangeInPer) >= this.formData.ChangeInPerFrom && Math.abs(x.ChangeInPer) <= this.formData.ChangeInPerTo) :
        this.gridList.filter(x => Math.abs(x.ChangeInPer) >= this.formData.ChangeInPerFrom && Math.abs(x.ChangeInPer) <= this.formData.ChangeInPerTo);
      isFilterData = true;
    }

    if (this.selectedList == TypeFlag.Gainer) {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.LTP > x.OpenHigh) : this.gridList.filter(x => x.LTP > x.OpenHigh);
    }
    else {
      filterData = filterData && filterData.length > 0 ? filterData.filter(x => x.LTP < x.OpenLow) : this.gridList.filter(x => x.LTP < x.OpenLow);
    }

    if (isFilterData) {
      this.dataSource.data = filterData;
    }
    else {
      this.dataSource.data = this.gridList;
    }
  }

  private calculateSLScanner(dataObj: GridList) {
    dataObj.IntradayQry = Math.round(this.budget / (dataObj.LTP / 5));

    const closePrice: number = dataObj.LTP - dataObj.ChangeInPoint;
    const points = closePrice * (1.45 / 100);
    if (this.selectedList == TypeFlag.Gainer) {
      dataObj.StopLoss = closePrice + points;
    }
    else {
      dataObj.StopLoss = closePrice - points;
    }
  }


  dataMapper(responseData: Daum[]): GridList[] {
    const mappedData = responseData.map(x => {
      return {
        StockId: x.Sid,
        StockName: x.Sym,
        DisplayName: x.DispSym,
        LTP: x.Ltp,
        StopLoss: 0, //Initial value as 0
        IntradayQry: 0, //Initial value as 0
        ChangeInPer: x.PPerchange,
        ChangeInPoint: x.Pchange,
        OpenHigh: x.openHigh,
        OpenLow: x.openLow,
        LastHigh: x.lastHigh,
        LastLow: x.lastLow
      }
    });
    return mappedData;
  }

  ngOnDestroy(): void {
    // Clear both timeout and interval when the component is destroyed
    clearTimeout(this.timeoutId);
    clearInterval(this.intervalId);
  }
}