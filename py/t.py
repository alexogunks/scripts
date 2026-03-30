# Simple python calculator

def add(a, b): print(f"The addition of {a} and {b} is: {a + b}")
def subtract(a, b): print(f"The subtraction of {a} and {b} is: {a - b}")
def multiply(a, b): print(f"The multiplication of {a} and {b} is: {a * b}")
def divide(a, b): print(f"The division of {a} and {b} is: {a / b}")
def main():
    try:
        print("1. Add\n2. Subtract\n3. Multiply\n4. Divide")
        option: int = int(input('Pick an option: '))
        if (option >= 1 and option <= 4): 
            a = int(input('First number: '))
            b = int(input('Second number: '))
            if (option == 1): add(a, b)
            elif (option == 2): subtract(a, b)
            elif (option == 3): multiply(a, b)
            elif (option == 4): divide(a, b)
        else:
            print('Option not in range. Aborting...')
            exit()
    except KeyboardInterrupt:
        print("\nExiting...")
        exit()
    except:
        pass

main()