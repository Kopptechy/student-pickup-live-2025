import http.server
import socketserver
import json
import os
import random
import time
import mimetypes
from urllib.parse import urlparse

# Configuration
PORT = 8001
PUBLIC_DIR = os.path.join(os.getcwd(), 'public')

# In-memory Database
db = {
    "students": [
        {"id": 1, "name": "John Doe", "year": 7, "class": "blue", "family_id": 1},
        {"id": 2, "name": "Jane Smith", "year": 8, "class": "red", "family_id": None},
        {"id": 3, "name": "Test Child", "year": 9, "class": "green", "family_id": None},
    ],
    "families": [
        {"id": 1, "name": "The Doe Family", "code": "CODE123", "created_at": time.time() * 1000}
    ],
    "users": [
        {"id": 1, "email": "admin@school.com", "password": "admin", "role": "admin", "is_approved": True, "family_id": None}
    ],
    "daily_codes": [],
    "pickups": []
}

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            
            # API Handling
            if path.startswith('/api'):
                self.handle_api_get(path)
                return

            # Static File Handling
            if path == '/':
                path = '/reception.html'
            
            # Clean path to prevent directory traversal
            path = path.lstrip('/').replace('..', '')
            file_path = os.path.join(PUBLIC_DIR, path)

            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.send_response(200)
                # Guess mime type
                mime_type, _ = mimetypes.guess_type(file_path)
                if mime_type:
                    self.send_header('Content-type', mime_type)
                self.end_headers()
                
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "File not found")
        except Exception as e:
            print(f"Error in GET: {e}")
            self.send_error(500, str(e))

    def handle_api_get(self, path):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        response = {}

        if path == '/api/years':
            response = [{"year": y} for y in range(7, 14)]
            
        elif path == '/api/students':
            response = db["students"]
            
        elif path.startswith('/api/students/year/'):
            try:
                year = int(path.split('/')[-1])
                response = [s for s in db["students"] if s["year"] == year]
            except:
                response = []
            
        elif path == '/api/pickups/pending':
            response = db["pickups"]
            
        elif path == '/api/parent/children':
            response = [s for s in db["students"] if s["family_id"] == 1]
            
        elif path.startswith('/api/pickup-code/'):
            code = path.split('/')[-1]
            daily_code = next((c for c in db["daily_codes"] if c["code"] == code), None)
            
            if daily_code:
                family = next((f for f in db["families"] if f["id"] == daily_code["family_id"]), None)
                student_ids = json.loads(daily_code["student_ids"])
                ids_list = [int(id) for id in student_ids] # ensure string/int match
                students = [s for s in db["students"] if s["id"] in ids_list]
                
                response = {
                    "family": family["name"],
                    "students": students
                }
            else:
                self.wfile.write(b'{"error": "Code not found"}') # Should send 404 properly but keeping simple for now
                return

        elif path == '/api/admin/pending-users':
            response = [u for u in db["users"] if not u["is_approved"]]
            
        self.wfile.write(json.dumps(response).encode())

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}

            response = {"success": True}
            status = 200

            # API Logic
            if path == '/api/auth/login':
                user = next((u for u in db["users"] if u["email"] == data.get("email")), None)
                if user:
                    response = {"success": True, "user": user}
                else:
                    status = 401
                    response = {"error": "Invalid credentials"}
            
            elif path == '/api/auth/signup':
                family = next((f for f in db["families"] if f["code"] == data.get("familyCode")), None)
                if family:
                    new_user = {
                        "id": len(db["users"]) + 1,
                        "email": data.get("email"),
                        "password": data.get("password"), 
                        "role": "parent",
                        "is_approved": False,
                        "family_id": family["id"],
                        "created_at": time.time() * 1000
                    }
                    db["users"].append(new_user)
                    response = {"success": True, "message": "Account created."}
                else:
                    status = 400
                    response = {"error": "Invalid Family Code"}

            elif path == '/api/pickup-code':
                new_code = {
                    "code": str(random.randint(100000, 999999)),
                    "family_id": 1,
                    "student_ids": json.dumps(data.get("studentIds", [])),
                    "expires_at": time.time() * 1000 + 86400000
                }
                db["daily_codes"].append(new_code)
                response = {"code": new_code["code"], "expiresAt": new_code["expires_at"]}
                
            elif path == '/api/pickups':
                new_pickup = {
                    "id": str(random.randint(1000,9999)),
                    "student_name": data.get("student_name"),
                    "year": data.get("year"),
                    "class": data.get("class"),
                    "timestamp": time.time() * 1000,
                    "status": "pending"
                }
                db["pickups"].append(new_pickup)
                
            # --- PREMIUM ONBOARDING ENDPOINTS ---

            elif path == '/api/admin/invite-batch':
                parents = data.get("parents", [])
                student_ids = data.get("studentIds", [])
                family_name = data.get("familyName")
                
                # Create Mock Family
                family_id = len(db["families"]) + 1
                if family_name:
                    db["families"].append({
                        "id": family_id,
                        "name": family_name,
                        "code": "INTERNAL", # No public code
                        "created_at": time.time() * 1000
                    })
                    
                    # Link students
                    for s in db["students"]:
                        if s["id"] in student_ids:
                            s["family_id"] = family_id
                
                results = []
                for p in parents:
                    if p.get("name") and p.get("role"):
                        # Generate Invite Code
                        code = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=6))
                        invite = {
                            "code": code,
                            "email": p.get("email", ""),
                            "name": p.get("name"),
                            "role": p.get("role"),
                            "student_ids": json.dumps(student_ids),
                            "family_id": family_id,
                            "is_used": False,
                            "expires_at": time.time() * 1000 + (7 * 86400000)
                        }
                        if "parent_invites" not in db: db["parent_invites"] = []
                        db["parent_invites"].append(invite)
                        
                        # Mock Email Delivery Log
                        print(f"\n[EMAIL MOCK] To: {invite['email']} | Subject: Welcome {invite['name']} ({invite['role']}) | Code: {invite['code']}\n")
                        
                        results.push({
                            "role": invite["role"],
                            "name": invite["name"],
                            "email": invite["email"],
                            "code": invite["code"]
                        })
                
                response = {"success": True, "invites": results}

            elif path == '/api/auth/validate-invite':
                code = data.get("code")
                invites = db.get("parent_invites", [])
                invite = next((i for i in invites if i["code"] == code), None)
                
                if not invite:
                    status = 404
                    response = {"error": "Invalid invite code"}
                elif invite["is_used"]:
                    status = 400
                    response = {"error": "Invite already used"}
                else:
                    # Get student details
                    s_ids = json.loads(invite["student_ids"])
                    mapped_students = [s for s in db["students"] if s["id"] in s_ids]
                    
                    response = {
                        "success": True,
                        "email": invite["email"],
                        "name": invite["name"],
                        "role": invite["role"],
                        "students": mapped_students
                    }

            elif path == '/api/auth/complete-signup':
                code = data.get("code")
                password = data.get("password")
                
                invites = db.get("parent_invites", [])
                invite = next((i for i in invites if i["code"] == code), None)
                
                if not invite or invite["is_used"]:
                    status = 400
                    response = {"error": "Invalid or used invite"}
                else:
                    # Create User
                    new_user = {
                        "id": len(db["users"]) + 1,
                        "email": invite["email"],
                        "password": password, 
                        "role": "parent",
                        "name": invite["name"], # Add name
                        "is_approved": True, # Auto-approve invited users
                        "family_id": invite["family_id"],
                        "created_at": time.time() * 1000
                    }
                    db["users"].append(new_user)
                    
                    # Mark Used
                    invite["is_used"] = True
                    
                    response = {"success": True, "message": "Account setup complete"}

            elif path == '/api/admin/families':
                new_family = {
                    "id": len(db["families"]) + 1,
                    "name": data.get("name"),
                    "code": str(random.randint(100000, 999999)),
                    "created_at": time.time() * 1000
                }
                db["families"].append(new_family)
                response = new_family
                
            elif path == '/api/admin/families/students':
                family = next((f for f in db["families"] if f["code"] == data.get("familyCode")), None)
                # handle both string and int ID
                sid = int(data.get("studentId"))
                student = next((s for s in db["students"] if s["id"] == sid), None)
                
                if family and student:
                    student["family_id"] = family["id"]
                    response = {"success": True, "familyName": family["name"]}
                else:
                    status = 404
                    response = {"error": "Family/Student not found"}

            elif '/approve' in path: 
                # URL is /api/admin/users/:id/approve
                try:
                    user_id = int(path.split('/')[-2])
                    pending = next((u for u in db["users"] if u["id"] == user_id), None)
                    if pending: pending["is_approved"] = True
                except:
                    pass

            self.send_response(status)
            self.send_header('Content-type', 'application/json')
            self.send_header('Set-Cookie', 'session_id=12345; Path=/')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            print(f"Error in POST: {e}")
            self.send_error(500, str(e))

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Handle requests in a separate thread."""
    pass

print(f"Starting Robust Test Server on http://localhost:{PORT}")
server = ThreadedHTTPServer(("", PORT), RequestHandler)
server.allow_reuse_address = True
server.serve_forever()
