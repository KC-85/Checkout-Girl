package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type fakeSender struct {
	message message
	err     error
}

func (f *fakeSender) Send(msg message) error {
	f.message = msg
	return f.err
}

func TestContactHandlerSendsValidMessage(t *testing.T) {
	sender := &fakeSender{}
	handler := contactHandler(sender, newLimiter(5, time.Minute))
	body := `{"name":"  Alex  ","email":"alex@example.com","subject":"Booking","message":"  Hello there  ","website":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/contact", bytes.NewBufferString(body))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body)
	}
	if sender.message.Name != "Alex" || sender.message.Body != "Hello there" {
		t.Fatalf("message was not normalised: %#v", sender.message)
	}
}

func TestContactHandlerRejectsInvalidMessage(t *testing.T) {
	sender := &fakeSender{}
	handler := contactHandler(sender, newLimiter(5, time.Minute))
	req := httptest.NewRequest(http.MethodPost, "/api/contact", bytes.NewBufferString(`{"name":"Alex","email":"bad","subject":"Hi","message":"Hello"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d; want %d", recorder.Code, http.StatusUnprocessableEntity)
	}
}

func TestContactHandlerHidesMailFailure(t *testing.T) {
	handler := contactHandler(&fakeSender{err: errors.New("smtp unavailable")}, newLimiter(5, time.Minute))
	req := httptest.NewRequest(http.MethodPost, "/api/contact", bytes.NewBufferString(`{"name":"Alex","email":"alex@example.com","subject":"Hi","message":"Hello"}`))
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("status = %d; want %d", recorder.Code, http.StatusBadGateway)
	}
	if bytes.Contains(recorder.Body.Bytes(), []byte("smtp unavailable")) {
		t.Fatal("internal SMTP error was exposed to the client")
	}
}

func TestLimiter(t *testing.T) {
	limits := newLimiter(2, time.Minute)
	now := time.Now()
	for requestNumber := 1; requestNumber <= 2; requestNumber++ {
		if !limits.allow("visitor", now) {
			t.Fatalf("request %d should be allowed", requestNumber)
		}
	}
	if limits.allow("visitor", now) {
		t.Fatal("third request should be rejected")
	}
}

func TestClientIP(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		forwarded  string
		want       string
	}{
		{
			name:       "Render forwarded IPv4",
			remoteAddr: "10.0.0.5:4321",
			forwarded:  "203.0.113.10, 10.0.0.5",
			want:       "203.0.113.10",
		},
		{
			name:       "Render forwarded IPv6",
			remoteAddr: "10.0.0.5:4321",
			forwarded:  "2001:db8::10, 10.0.0.5",
			want:       "2001:db8::10",
		},
		{
			name:       "malformed forwarded address falls back",
			remoteAddr: "192.0.2.20:4321",
			forwarded:  "not-an-ip, 203.0.113.10",
			want:       "192.0.2.20",
		},
		{
			name:       "local direct request",
			remoteAddr: "192.0.2.30:4321",
			want:       "192.0.2.30",
		},
		{
			name:       "IPv6 remote address",
			remoteAddr: "[2001:db8::20]:4321",
			want:       "2001:db8::20",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/contact", nil)
			req.RemoteAddr = test.remoteAddr
			if test.forwarded != "" {
				req.Header.Set("X-Forwarded-For", test.forwarded)
			}

			if got := clientIP(req); got != test.want {
				t.Fatalf("clientIP() = %q; want %q", got, test.want)
			}
		})
	}
}

func TestStaticHandlerDoesNotExposeEnvironmentFile(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, ".env"), []byte("SMTP_PASSWORD=secret"), 0600); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/.env", nil)
	recorder := httptest.NewRecorder()

	staticHandler(directory).ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d; want %d", recorder.Code, http.StatusNotFound)
	}
	if bytes.Contains(recorder.Body.Bytes(), []byte("secret")) {
		t.Fatal("environment file contents were exposed")
	}
}
