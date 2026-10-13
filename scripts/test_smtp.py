import smtplib

email = "kumarimmbizsoft@gmail.com"
password = "gfdeqsrjhixpxubi"
to_email = "kumaraids2006@gmail.com"

try:
    server = smtplib.SMTP("smtp.gmail.com", 587)
    server.set_debuglevel(1)
    server.starttls()
    server.login(email, password)
    print("Login successful! Sending email...")
    
    subject = "ImmBiz Books - Password Reset OTP"
    body = "Hello User,\n\nYour OTP for password reset is: 123456\n\nThis OTP is valid for 15 minutes."
    msg = f"Subject: {subject}\n\n{body}"
    
    server.sendmail(email, to_email, msg)
    print("Email sent successfully!")
    server.quit()
except Exception as e:
    print(f"SMTP Error: {e}")
