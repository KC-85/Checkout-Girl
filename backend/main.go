package main

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

const maxRequestSize = 32 << 10

type config struct {
	port         string
	staticDir    string
	smtpHost     string
	smtpPort     string
	smtpUsername string
	smtpPassword string
	mailFrom     string
	mailTo       string
}

func loadConfig() (config, error) {
	cfg := config{
		port:         envOr("PORT", "8080"),
		staticDir:    resolveStaticDir(envOr("STATIC_DIR", "frontend")),
		smtpHost:     os.Getenv("SMTP_HOST"),
		smtpPort:     envOr("SMTP_PORT", "587"),
		smtpUsername: os.Getenv("SMTP_USERNAME"),
		smtpPassword: os.Getenv("SMTP_PASSWORD"),
		mailFrom:     os.Getenv("MAIL_FROM"),
		mailTo:       os.Getenv("MAIL_TO"),
	}

	var missing []string
	for key, value := range map[string]string{
		"SMTP_HOST": cfg.smtpHost,
		"MAIL_FROM": cfg.mailFrom,
		"MAIL_TO":   cfg.mailTo,
	} {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return config{}, fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}
	if (cfg.smtpUsername == "") != (cfg.smtpPassword == "") {
		return config{}, errors.New("SMTP_USERNAME and SMTP_PASSWORD must be set together")
	}
	if _, err := mail.ParseAddress(cfg.mailFrom); err != nil {
		return config{}, fmt.Errorf("invalid MAIL_FROM: %w", err)
	}
	if _, err := mail.ParseAddress(cfg.mailTo); err != nil {
		return config{}, fmt.Errorf("invalid MAIL_TO: %w", err)
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func resolveStaticDir(configured string) string {
	for _, candidate := range []string{configured, "frontend", "../frontend"} {
		if _, err := os.Stat(path.Join(candidate, "index.html")); err == nil {
			return candidate
		}
	}
	return configured
}

type message struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Body    string `json:"message"`
	Website string `json:"website"`
}

type mailSender interface {
	Send(message) error
}

type smtpSender struct{ cfg config }

func (s smtpSender) Send(msg message) error {
	address := net.JoinHostPort(s.cfg.smtpHost, s.cfg.smtpPort)
	var auth smtp.Auth
	if s.cfg.smtpUsername != "" {
		auth = smtp.PlainAuth("", s.cfg.smtpUsername, s.cfg.smtpPassword, s.cfg.smtpHost)
	}

	from, _ := mail.ParseAddress(s.cfg.mailFrom)
	to, _ := mail.ParseAddress(s.cfg.mailTo)
	subject := "Website message: " + msg.Subject
	body := strings.Join([]string{
		"From: " + from.String(),
		"To: " + to.String(),
		"Reply-To: " + (&mail.Address{Name: msg.Name, Address: msg.Email}).String(),
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"",
		"Name: " + msg.Name,
		"Email: " + msg.Email,
		"",
		msg.Body,
	}, "\r\n")

	return sendSMTP(address, s.cfg.smtpHost, from.Address, to.Address, auth, []byte(body))
}

// sendSMTP requires TLS via either implicit TLS (port 465) or STARTTLS.
func sendSMTP(address, host, from, to string, auth smtp.Auth, body []byte) error {
	if strings.HasSuffix(address, ":465") {
		conn, err := tls.Dial("tcp", address, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return err
		}
		defer conn.Close()
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
		defer client.Close()
		return deliver(client, from, to, auth, body)
	}

	client, err := smtp.Dial(address)
	if err != nil {
		return err
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return errors.New("SMTP server does not support STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
		return err
	}
	return deliver(client, from, to, auth, body)
}

func deliver(client *smtp.Client, from, to string, auth smtp.Auth, body []byte) error {
	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(body); err != nil {
		return err
	}
	return writer.Close()
}

type visitor struct {
	count int
	reset time.Time
}

type limiter struct {
	mu       sync.Mutex
	visitors map[string]visitor
	limit    int
	window   time.Duration
}

func newLimiter(limit int, window time.Duration) *limiter {
	return &limiter{visitors: make(map[string]visitor), limit: limit, window: window}
}

func (l *limiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	v := l.visitors[key]
	if now.After(v.reset) {
		v = visitor{reset: now.Add(l.window)}
	}
	if v.count >= l.limit {
		return false
	}
	v.count++
	l.visitors[key] = v
	return true
}

func clientIP(r *http.Request) string {
	// Render places the original visitor address first in X-Forwarded-For.
	// Trust only that entry, and only when it contains a valid IP address.
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		first, _, _ := strings.Cut(forwarded, ",")
		if ip := net.ParseIP(strings.TrimSpace(first)); ip != nil {
			return ip.String()
		}
	}

	// Local development connects directly, so RemoteAddr contains the visitor
	// address and usually includes a port.
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		if ip := net.ParseIP(host); ip != nil {
			return ip.String()
		}
		return host
	}
	if ip := net.ParseIP(strings.Trim(r.RemoteAddr, "[]")); ip != nil {
		return ip.String()
	}
	return r.RemoteAddr
}

func contactHandler(sender mailSender, limits *limiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			writeJSON(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		if !limits.allow(clientIP(r), time.Now()) {
			w.Header().Set("Retry-After", strconv.Itoa(int(limits.window.Seconds())))
			writeJSON(w, http.StatusTooManyRequests, "too many messages; please try again later")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxRequestSize)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var msg message
		if err := decoder.Decode(&msg); err != nil {
			writeJSON(w, http.StatusBadRequest, "invalid request")
			return
		}
		normalise(&msg)
		if msg.Website != "" { // Honeypot: pretend success so bots get no useful signal.
			writeJSON(w, http.StatusOK, "message sent")
			return
		}
		if err := validate(msg); err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		if err := sender.Send(msg); err != nil {
			log.Printf("send mail: %v", err)
			writeJSON(w, http.StatusBadGateway, "message could not be sent; please try again")
			return
		}
		writeJSON(w, http.StatusOK, "message sent")
	}
}

func normalise(msg *message) {
	msg.Name = strings.TrimSpace(msg.Name)
	msg.Email = strings.TrimSpace(msg.Email)
	msg.Subject = strings.TrimSpace(msg.Subject)
	msg.Body = strings.TrimSpace(msg.Body)
	msg.Website = strings.TrimSpace(msg.Website)
}

func validate(msg message) error {
	if msg.Name == "" || len(msg.Name) > 100 {
		return errors.New("please enter a name of up to 100 characters")
	}
	address, err := mail.ParseAddress(msg.Email)
	if err != nil || address.Address != msg.Email || len(msg.Email) > 254 {
		return errors.New("please enter a valid email address")
	}
	if msg.Subject == "" || len(msg.Subject) > 150 {
		return errors.New("please enter a subject of up to 150 characters")
	}
	if msg.Body == "" || len(msg.Body) > 5000 {
		return errors.New("please enter a message of up to 5,000 characters")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": message})
}

func staticHandler(directory string) http.Handler {
	files := http.FileServer(http.Dir(directory))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean("/" + r.URL.Path)
		allowedRootFile := cleanPath == "/" || cleanPath == "/index.html" || cleanPath == "/robots.txt" || cleanPath == "/sitemap.xml"
		if !allowedRootFile && !strings.HasPrefix(cleanPath, "/assets/") {
			http.NotFound(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, "ok")
	})
	mux.Handle("POST /api/contact", contactHandler(smtpSender{cfg}, newLimiter(5, 10*time.Minute)))
	mux.Handle("/", staticHandler(cfg.staticDir))

	server := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("Checkout Girl listening on http://localhost:%s", cfg.port)
	log.Fatal(server.ListenAndServe())
}
