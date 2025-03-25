import email_service

print("Forcing email check...")
result = email_service.force_check()
print(f"Check completed. Result: {result}") 