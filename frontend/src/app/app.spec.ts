// import { TestBed } from '@angular/core/testing';
// import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
// import { App } from './app';

// describe('App', () => {
//   let component: App;
//   let fixture: any;
//   let httpMock: HttpTestingController;

//   beforeEach(async () => {
//     await TestBed.configureTestingModule({
//       imports: [App, HttpClientTestingModule]
//     }).compileComponents();

//     fixture = TestBed.createComponent(App);
//     component = fixture.componentInstance;
//     httpMock = TestBed.inject(HttpTestingController);
//   });

//   afterEach(() => {
//     httpMock.verify();
//   });

//   it('should create', () => {
//     expect(component).toBeTruthy();
//   });

//   it('should have initial values', () => {
//     expect(component.message).toBe('');
//     expect(component.loading).toBe(false);
//   });

//   it('should fetch message on init', () => {
//     const mockResponse = { message: 'Hello from Flask!' };

//     component.ngOnInit();

//     const req = httpMock.expectOne('/api/hello');
//     expect(req.request.method).toBe('GET');
//     req.flush(mockResponse);

//     expect(component.message).toBe('Hello from Flask!');
//     expect(component.loading).toBe(false);
//   });

//   it('should handle error when fetching message', () => {
//     spyOn(console, 'error');

//     component.ngOnInit();

//     const req = httpMock.expectOne('/api/hello');
//     req.error(new ErrorEvent('Network error'));

//     expect(component.message).toBe('Error connecting to backend');
//     expect(component.loading).toBe(false);
//     expect(console.error).toHaveBeenCalled();
//   });

//   it('should set loading to true when fetching message', () => {
//     component.fetchMessage();
//     expect(component.loading).toBe(true);

//     const req = httpMock.expectOne('/api/hello');
//     req.flush({ message: 'Test message' });
//   });
// }); 
