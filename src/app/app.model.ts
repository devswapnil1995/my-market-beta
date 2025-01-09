export interface NseDataSet {
    exch: string;
    seg: string;
    sid: number;
    sym: string;
    inst: string;
    exp: string;
    stk: number;
    otype: string;
    srs: string;
    ts: number;
    ls: number;
    mtp: number;
    disp: string;
    ltp: number;
    tvol: number;
    chng: number;
    pchng: number;
    isin: string;
    u_b_id: number;
    u_scrip_id: number;
    tval: number;
    oi: number;
    oiper: number;
    oichng: number;
    rec: number;
    fall: number;
    seo: string;
    pcr: number;
    intradayQty: number; //max qty we can buy
    openHigh: number; //1st candle close high
    openLow: number; //1st candle close low
    lastHigh: number; //Last candle close high
    lastLow: number; //Last candle close low
    StopLoss: number;
}

export interface FilterObj {
    Seg: number,
    SecIdxCode: number,
    Count: number,
    TypeFlag: string,
    DayLevelIndicator: number,
    ExpCode: number,
    Instrument: string
}

export interface FormData {
    StockName: string,
    ChangeInPerFrom: number,
    ChangeInPerTo: number
}

export interface timeData {
    END: number;
    END_TIME: string;
    EXCH: string;
    INST: string;
    INTERVAL: string;
    SEC_ID: number;
    SEG: string;
    START: number;
    START_TIME: string;
}

export interface timeDataRecords {
    o: number[];
    h: number[];
    l: number[];
    c: number[];
    v: number[];
    t: number[];
    oi: number[];
    Time: string[];
}

export interface allRecords {
    sid: number;
    timeDataRecords: timeDataRecords;
    lastUpdatedOn: string | undefined;
}

export enum TypeFlag {
    Gainer = "G",
    Loser = "L"
}


export interface ScannerModel {
    sort: string
    sorder: string
    count: number
    params: Param[]
    fields: string[]
    pgno: number
}

export interface Param {
    field: string
    op: string
    val: string
}


export interface ScannerResponse {
    code: number
    remarks: string
    tot_rec: number
    tot_pg: number
    last_resp_time: string
    data: Daum[]
}

export interface Daum {
    DispSym: string;
    Exch: string;
    FIIHolding: number;
    High1Yr: number;
    Inst: string;
    Isin: string;
    LotSize: number;
    Low1Yr: number;
    Ltp: number;
    Mcap: number;
    Min15EMA10CurrentCandle: number;
    Multiplier: number;
    PPerchange: number;
    Pchange: number;
    Pe: number;
    PricePerchng1week: number;
    Seg: string;
    Seosym: string;
    Sid: number;
    Sym: string;
    TickSize: number;
    Volume: number;
    YearlyRevenue: number;
    intradayQty: number; //max qty we can buy
    openHigh: number; //1st candle close high
    openLow: number; //1st candle close low
    lastHigh: number; //Last candle close high
    lastLow: number; //Last candle close low
    StopLoss: number;
}
