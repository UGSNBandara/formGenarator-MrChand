/*
 * This is the base service calling service. Here is generic implementation for any http request handle. 
 * http methods are GET, PUT, POST, DELETE. If the request need token then consumer has to pass 'isAuthorizedRequest'  as true
 * else consumer has to pass false. 
 * developer :- Amila Viduranga
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BaseService {

  constructor(private http: HttpClient) { }
  get(path: any, isAuthorizedRequest: boolean): Observable<any> {
    if (isAuthorizedRequest) {
      return this.http.get(path, {
        headers: {
          "Authorization": this.tokenGenerator(),
          "token": this.tokenRaw()
        }
      })
    } else {
      return this.http.get(path);
    }
  }

  post(path: any, isAuthorizedRequest: boolean, data: any): Observable<any> {
    if (isAuthorizedRequest) {
      return this.http.post(path, data, {
        headers: {
          "Authorization": this.tokenGenerator(),
          "token": this.tokenRaw(),
        }
      });
    } else {
      return this.http.post(path, data);
    }
  }

  put(path: any, isAuthorizedRequest: boolean, data: any): Observable<any> {
    if (isAuthorizedRequest) {
      return this.http.put(path, data, {
        headers: {
          "Authorization": this.tokenGenerator(),
          "token": this.tokenRaw()
        }
      })
    } else {
      return this.http.put(path, data);
    }
  }

  delete(path: any, isAuthorizedRequest: boolean, data: any): Observable<any> {
    if (isAuthorizedRequest) {
      return this.http.request("delete", path, {
        headers: {
          "Authorization": this.tokenGenerator(),
          "token": this.tokenRaw()
        },
        body: data
      })
    } else {
      return this.http.request("delete", path, {
        body: data
      });
    }
  }

  patch(path: any, isAuthorizedRequest: boolean, data: any): Observable<any> {
    if (isAuthorizedRequest) {
      return this.http.patch(path, data, {
        headers: {
          "Authorization": this.tokenGenerator(),
          "token": this.tokenRaw()
        }
      });
    } else {
      return this.http.patch(path, data);
    }
  }

  private tokenGenerator() {
    return "Bearer " + this.tokenRaw();
  }

  private tokenRaw() {
    return sessionStorage.getItem("token") || '';
  }
}
