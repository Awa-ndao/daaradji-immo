import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      }
    });
    return next(cloned);
  }
  
  const withAccept = req.clone({
    setHeaders: {
      'Accept': 'application/json'
    }
  });
  return next(withAccept);
};