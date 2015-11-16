#!/usr/bin/env python3

import re
from collections import defaultdict
from functools import reduce, total_ordering
from itertools import chain
from os.path import dirname

from .pegparse import create_parser_from_file

code2text = {
    "AMST": "American Studies",
    "ARAB": "Arabic",
    "ART": "Art History & Visual Arts",
    "BICH": "Biochemistry",
    "BIO": "Biology",
    "CHEM": "Chemistry",
    "CHIN": "Chinese",
    "CLAS": "Classical Studies",
    "COGS": "Cognitive Science",
    "CSLC": "Comparative Studies in Literature and Culture",
    "COMP": "Computer Science",
    "CTSJ": "Critical Theory & Social Justice",
    "CSP": "Cultural Studies Program",
    "DWA": "Diplomacy & World Affairs",
    "ECON": "Economics",
    "EDUC": "Education",
    "ENGL": "English",
    "FREN": "French",
    "GEO": "Geology",
    "GERM": "German",
    "GRK": "Greek",
    "HIST": "History",
    "JAPN": "Japanese",
    "KINE": "Kinesiology",
    "LATN": "Latin",
    "LLAS": "Latino/a & Latin American Studies",
    "LING": "Linguistics",
    "MATH": "Mathematics",
    "MUSC": "Music",
    "MUSA": "Music Applied Study",
    "PHIL": "Philosophy",
    "PHAC": "Physical Activities",
    "PHYS": "Physics",
    "POLS": "Politics",
    "PSYC": "Psychology",
    "RELS": "Religious Studies",
    "RUSN": "Russian",
    "SOC": "Sociology",
    "SPAN": "Spanish & French Studies",
    "THEA": "Theater",
    "UEP": "Urban & Environmental Policy",
    "WRD": "Writing & Rhetoric",
}
text2code = {}
for code, text in code2text.items():
    text2code[text] = code

IR_PARSER = create_parser_from_file(dirname(__file__) + '/ir.ebnf')

@total_ordering
class CourseDescription:
    def __init__(self, department, number, text):
        self.department = department
        self.number = number
        self.text = text
    def __str__(self):
        return "{} {}".format(self.department, self.number)
    def __lt__(self, other):
        return str(self) < str(other)

def str_find_all(needle, haystack):
    if haystack.find(needle) == -1:
        return ()
    starts = [haystack.find(needle)]
    while haystack.find(needle, starts[-1] + len(needle)) != -1:
        starts.append(haystack.find(needle, starts[-1] + len(needle)))
    return tuple((start, start+len(needle)) for start in starts)

def split_str(s, indices, clever=True):
    if not indices:
        return (s,)
    result = []
    if not clever or indices[0] > 0:
        result.append(s[:indices[0]])
    for start, end in zip(indices[:-1], indices[1:]):
        result.append(s[start:end])
    if not clever or indices[-1] < len(s):
        result.append(s[indices[-1]:])
    return tuple(result)

def create_text_fn(ast):
    subtext = ast.descendants('*')[0]
    if subtext.term == 'PresetText':
        preset = subtext.descendants('TextClass')[0].match
        if preset == 'Number':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer('[0-9]+', course.text)))
        elif preset == 'Capital Letter':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer('[A-Z]+', course.text)))
        elif preset == 'Three Digits':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer('[0-9]{3}', course.text)))
        elif preset == 'Department Name':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer(course.department, course.text)))
        elif preset == 'Department Code':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer(text2code[course.department], course.text)))
        elif preset == 'Course Number':
            return (lambda course: tuple((match.start(), match.end()) for match in re.finditer(course.number, course.text)))
    elif subtext.term == 'CustomText':
        return (lambda course: str_find_all(subtext.match, course.text))

def create_location_fn(ast):
    modifier = ast.descendants('LocationModifier')[0]
    text_fn = create_text_fn(ast.descendants('Text')[0])
    if modifier.match == 'before':
        return (lambda course: tuple(pair[0] for pair in text_fn(course)))
    elif modifier.match == 'after':
        return (lambda course: tuple(pair[1] for pair in text_fn(course)))

def create_text(ast):
    if ast.descendants('*')[0].term == 'PresetText':
        preset = ast.descendants('PresetText/TextClass')[0].match
        if preset == 'Department Name':
            return (lambda course: course.department)
        elif preset == 'Department Code':
            return (lambda course: text2code[course.department])
        elif preset == 'Course Number':
            return (lambda course: course.number)
    else:
        return (lambda course: ast.match)

def create_select(ast):
    negated = (ast.descendants('Negation')[0].match == 'does not')
    selector = ast.descendants('Selector')[0]
    text_fn = create_text_fn(ast.descendants('Text')[0])
    if selector.match == 'contain':
        if negated:
            return (lambda course: (course,) if len(text_fn(course)) == 0 else ())
        else:
            return (lambda course: (course,) if len(text_fn(course)) > 0 else ())
    elif selector.match == 'start with':
        if negated:
            return (lambda course: (course,) if not text_fn(course) or text_fn(course)[0][0] != 0 else ())
        else:
            return (lambda course: (course,) if text_fn(course) and text_fn(course)[0][0] == 0 else ())
    elif selector.match == 'end with':
        if negated:
            return (lambda course: (course,) if not text_fn(course) or text_fn(course)[-1][1] != len(course) else ())
        else:
            return (lambda course: (course,) if text_fn(course) and text_fn(course)[-1][1] == len(course) else ())

def create_break(ast):
    location_fn = create_location_fn(ast.descendants('Location')[0])
    return (lambda course: tuple(CourseDescription(course.department, course.number, text) for text in split_str(course.text, location_fn(course))))

def create_insert(ast):
    location_fn = create_location_fn(ast.descendants('Location')[0])
    text_fn = create_text(ast.descendants('Text')[0])
    return (lambda course: (CourseDescription(course.department, course.number, course.text[:location_fn(course)[0]] + text_fn(course) + course.text[location_fn(course)[0]:]),) if location_fn(course) else (course,))

def create_delete(ast):
    location_fn = create_location_fn(ast.descendants('Location')[0])
    deletion_range = ast.descendants('DeletionRange')[0].match
    if deletion_range == 'until':
        return (lambda course: (CourseDescription(course.department, course.number, course.text[location_fn(course)[0]:]),) if location_fn(course) else (course,))
    elif deletion_range == 'from':
        return (lambda course: (CourseDescription(course.department, course.number, course.text[:location_fn(course)[-1]]),) if location_fn(course) else (course,))

def create_replace(ast):
    before, after = (create_text(child) for child in ast.descendants('Text'))
    return (lambda course: (CourseDescription(course.department, course.number, course.text.replace(before(course), after(course))),))

def create_transforms(ast):
    # functions that takes a list and returns a list
    transforms = []
    for operation in ast.descendants('Statement/Operation/*'):
        if operation.term == 'Select':
            transforms.append(create_select(operation))
        elif operation.term == 'Break':
            transforms.append(create_break(operation))
        elif operation.term == 'Insert':
            transforms.append(create_insert(operation))
        elif operation.term == 'Delete':
            transforms.append(create_delete(operation))
        elif operation.term == 'Replace':
            transforms.append(create_replace(operation))
    return transforms

def run_transforms(transforms, course):
    return reduce((lambda courses, fn: tuple(chain(*tuple(fn(c) for c in courses)))), transforms, (course,))

def read_program_from_file(file):
    with open(file) as fd:
        return fd.read()

def run_program_on_descriptions(program, departments):
    program = ''.join(line.lstrip() + '\n' for line in program.splitlines() if line.strip())
    ast = IR_PARSER.parse(program, 'Program')
    if not ast:
        print('program has syntax errors')
        exit(1)
    transforms = create_transforms(ast)
    result = defaultdict(list)
    descriptions = []
    with open(dirname(__file__) + '/descriptions') as fd:
        descriptions = fd.read().split("\n\n")
    for description in descriptions:
        if description.splitlines()[0] not in departments:
            continue
        lines = description.strip().splitlines()
        department = lines[0].strip()
        number = lines[1].strip()
        number = number[:number.index(' ')]
        course = CourseDescription(department, number, description)
        for line in description.splitlines():
            result[course].extend(run_transforms(transforms, CourseDescription(department, number, line.strip())))
    return result


def main():
    #select\tdoes\tcontain\t\tnumber
    #select\tdoes not\tend with\t4
    #break apart\tafter\t2
    #insert\tbefore\ta\thello!
    #delete\tuntil\tbefore\t!
    #replace\ts\tworld
    #insert\tbefore\tPreref\t\tDepartment Name
    program = """
        select\tdoes\tcontain\tPrereq
        break apart\tbefore\t,
        delete\tuntil\tafter\t: 
        delete\tuntil\tafter\t, 
        select\tdoes\tcontain\t\tThree Digits
        delete\tuntil\tbefore\t\tCapital Letter
        break apart\tbefore\t or 
        delete\tuntil\tafter\t or 
        replace\t\tDepartment Name\t\tDepartment Code
        delete\tfrom\tafter\t\tThree Digits
        select\tdoes not\tcontain\tperm
        delete\tuntil\tafter\tOR
        delete\tuntil\tbefore\t\tCapital Letter
        replace\tCog Sci\tCOGS
        insert\tbefore\t211\t\tDepartment Code
    """
    descriptions  = (
        """
        Cognitive Science
        101 - Introduction to Cognitive Sciences
        An interdisciplinary introduction to the discovery of the mind through philosophical texts, psychological experiments, artificial intelligence, the study of nerve cells and neural networks and investigations into language. The purpose of the course is to foster an appreciation of the wonder and complexity of minds and brains, both human and otherwise. Not open to seniors in spring semester.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        104 - Introduction to Neuroscience
        This course provides a basic introduction to the nervous system [for students with little or no experience in this area]. It will include an introduction to how nerve and glial cells contribute to different brain functions. Brain structures and systems and how they act to produce sensory experience, thought, emotion, and memory will also be covered. Other topics might include: factors that affect embryonic development of the nervous system, and the effect of drugs, environment, stress, education, and age on the brain. This course is not open to students who have taken Biology 333, Cognitive Science 320, Kinesiology 301 or Psychology 322.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        210 - Introduction to Artificial Intelligence
        Can one create intelligent machines-machines capable of posing and solving problems and of interacting effectively with a complex and dynamic environment? If so, how? And what insights into natural cognition do we gain through efforts to create artificial intelligence? Fundamental principles, architectures, and algorithms for machine perception, control, and problem-solving will be addressed. We will also look in detail at strategies for developing intelligent machines, including traditional Artificial Intelligence and the more recent perspectives of situated and embodied cognition. The laboratory component of the course will involve computing and simple robotic devices.
        Prerequisite: COGS 242, or MATH 186, or MATH 210, or permissionof instructor
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        230 - Mind, Brain, and Behaviour
        This course addresses the question: how can we understand the mind scientifically? We will explore answers to this question via a critical survey of neural and behavioral evidence bearing on the nature of core cognitive capacities, including perception, memory, emotion, decision-making, rationality, and consciousness. We will explore these sources of evidence in a comparative perspective, drawing on evidence of both human and (non-human) animal cognition to more adequately characterize the nature of cognition generally.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        241 - Cognition of Music and Sound
        As part of human cognition, our perception, production, and understanding of music has elicited many questions: What is music in relation to "sound"? Is music an evolutionary adaptation? What is the relationship of music and emotions, or memory? Can music influence perception in other modalities? What is the meaning of music? Can music make us smarter? Is music a language? What is biological and what is cultural in the esthetics of music? This course will reframe many of these questions from the interdisciplinary standpoint of cognitive science, acoustics, music theory, and semiotics to explore music as a cognitive process Topics will include the perception of pitch, timbre, rhythm, and localization; music and the brain; cognitive aspect of the esthetics of music; the relationship between music and language in terms of their structures and neurological processing; music and memory; music and emotions; music and meaning. We will also discuss the role music plays in cross-modal interactions, either in the real world, or in films and multimedia art works.
        Same as MUSC 241.
        Prerequisite: Any Cognitive Science class or Music class, or instructor's approval
        CORE REQUIREMENT MET: MATH/SCIENCE ● FINE ARTS
        """,
        """
        Cognitive Science
        242 - Computational Approaches to Cognition
        Computational modeling provides important insights into how the mind/brain may work. We will examine three different approaches that have been used to provide insights into cognition: symbolic methods, connectionism, and probabilistic methods. We will use computer software to explore how these approaches work in practice. Specific applications such as perception, language, and memory will be covered. The assumptions and limitations of each approach, as well as the metaphor of mind/brain as a computer, will be critically considered. This course has a mandatory laboratory component which will include both experimentation and computer programming. No previous programming background is required.
        Prerequisite: Cog Sci 101 as prereq or coreq OR prereq of Phil 225, Math 186, 210, 214, 252, or CS 157, 161, 165, or 211 OR permission of instructor
        CORE REQUIREMENT MET: LAB-SCI
        """,
        """
        Cognitive Science
        250 - Multisensory Perception and Cognition
        Traditionally, the senses have been thought to operate independently. However, there is increasing evidence that the brain is fundamentally multisensory. This course will explore how the brain encodes input from each of the senses, and how it integrates this information to create our perceptions of the world. We will consider converging evidence from methodologies such as psychophysics, neuroimaging, neural recording, and neurology. The laboratory component of the class will include experiments within individual senses as well as those that explore integration of the senses. Prerequisite: Cognitive Science 101, Cognitive Science 104, Psychology 302, or permission of instructor.
        Prerequisite: Cog Sci 101, Cog Sci 104, Psych 302, or permission of instructor.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        255 - Data Analysis and Visualization
        The primary goal of this course is twofold: 1) to provide students from a wide range of disciplines with hands-on training to analyze a variety of datasets relevant to their course of study, and 2) to provide them with the tools to understand the rhetorical form and function of different types of data visualizations. Students will consider how questions can be answered using data, learn how to analyze data appropriately, learn to design and present graphs that tell an easy-to-understand visual story, have high impact, and are memorable, and critically consider the assumptions underlying accurate interpretation of analyses and visualizations. Students from any major are welcome.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        292 - Brain Plasticity
        Mechanisms of brain development, growth, neurogenesis, maturation, and changes that occur during life. Emphasis will be placed on current literature and studies done in nonhuman animals and humans. We will also talk about what it takes to maintain a healthy brain.
        Prerequisite: CogSci 101, 104, or permission of instructor.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        295 - Topics in Cognitive Science
        Intelligent Agents.This course explores the some of the issues in the nature of intelligent agents: Concepts are the building blocks of thoughts; they are what allow intelligent agents to think about, reason about, and understand the world around them. This course will explore major theories of the nature of concepts from philosophy, psychology, linguistics, neuroscience, and related fields. The goal will be to gain a better appreciation of what concepts are, and how the study of concepts ties together different fields in the study of cognition.
        Prereq: Any cog sci course or permission of instructor.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        301 - Applied Cognitive Science and Education
        This course will address current cognitive science research as applied to learning and education. The concept of multiple intelligences, as well as strengths and weaknesses of individuals in acquisition of information will be emphasized. We will also cover specific learning disabilities/differences and cognitive styles.
        Prerequisite: Cognitive Science 101, declared minor in Education, or permission of instructor.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        310 - Research Methods in Cognitive Science
        This course provides students with a foundation to think critically about research in cognitive science and lays the groundwork for the original research that will be done in the senior year. We will examine primary literature, considering carefully the processes involved in moving from a general idea to a specific research question. We will consider the strengths and weaknesses of a range of approaches to studying cognition with a focus on experimental design. Laboratory sessions will introduce students to basic research tools and data collection. The course will culminate in an original research proposal.
        Prerequisite: Cognitive Science 101
        Corequisite: COGS 310L
        CORE REQUIREMENT MET: INTERCULTURAL ● LAB SCIENCE
        """,
        """
        Cognitive Science
        320 - Cognitive Neuroscience
        This course is an introduction to the biology and physiology of the nervous system from the perspective of cognition. The material that the course covers will start with membrane biophysics and the production of electrical signals by nerve cells. Then studies of synapses, learning, memory, and plasticity of neural connections will be covered. Finally, the course will conclude examining models of simple nervous systems (non-human and computer-generated).
        Prerequisite: Cognitive Science 101, Biology 130, or Psychology 322, or permission of the instructor. Familiarity with high school or college physics is beneficial. Co-requisite: Cognitive Science 320L
        CORE REQUIREMENT MET: LAB-SCI
        """,
        """
        Cognitive Science
        325 - Topics in Artificial Intelligence
        Although modern artificial intelligence no longer resembles cognitive science, many of the underlying ideas take inspiration from and share parallels with descriptions of human intelligence. This course aims to look at some of these topics through both lenses, as well as consider other topics in AI that may be trivial by human standards, but remain open problems in computer science.
        Prerequisite: Cog Sci 101, Comp Sci 210 or 211 or instructor permission
        CORE REQUIREMENT MET: MATH/SCIENCE
        """,
        """
        Cognitive Science
        330 - Linguistics for Cognitive Science
        Language and cognition are intimately related. For this reason Linguistics has had an extremely strong influence on Cognitive Science. This course studies language and linguistics in the context of Cognitive Science. We will address such questions as how are language and thought related? How is language represented in the brain? How do we process language? To what extent is the human capacity for language innate? Is there a language of thought? What are the best ways to model language acquisition and language processing? We will cover some topics in traditional linguistics, and we will look at current research on connectionist and traditional artificial intelligence approaches to modeling language. Reading will include work by Chomsky, Pinker, McClelland, Rumelhart, Fodor and Elman.
        Prerequisite: Cognitive Science 101 or LING 301.
        CORE REQUIREMENT MET: MATH/SCI
        """,
        """
        Cognitive Science
        340 - Human-Computer Interaction
        What factors contribute to making a website easy to use versus frustrating to navigate? How can we apply what we know about the mind to design technologies that foster positive user experiences? We will apply cognitive science findings about attention, perception, memory, and more to study how humans interact with technology.
        Prerequisite: Cognitive Science 310.
        CORE REQUIREMENT MET: MATH/SCIENCE
        """,
        """
        Cognitive Science
        343 - Probabilistic Models of Cognition
        Probabilistic models have increasingly been applied to understand how the mind works across domains such as motor control, decision-making, and causal inference. We will learn how such models work, learning the mathematical tools necessary to implement them, such as Bayesian inference, graphical models, and Markov models. We will consider both how human cognition can inform machine learning and how computational approaches can lead to new ideas about cognition.
        Prerequisite: Cognitive Science 242,
        Co-requisite: Cognitive Science 343L
        CORE REQUIREMENT MET: LAB-SCI
        """,
        """
        Cognitive Science
        395 - Directed Research in Cognitive Science
        Directed research with a faculty member.
        Prerequisite: COGS 101 or permission of instructor
        2 or 4
        """,
        """
        Cognitive Science
        397 - Independent Study in Cognitive Science
        Prerequisite: permission of instructor.
        2 or 4 units
        """,
        """
        Cognitive Science
        490 - Senior Seminar in Cognitive Science
        This course will support senior cognitive science majors as they conduct original research as part of their senior comprehensive requirement. Prerequisite: Cognitive Science 101 and senior standing in Cognitive Science.
        Prerequisite: Cognitive Science 101, senior standing in Cognitive Science; or permission of instructor
        """,
    )
    program = ''.join(line.lstrip() + '\n' for line in program.splitlines() if line.strip())
    ast = IR_PARSER.parse(program, 'Program')
    if not ast:
        print('program has syntax errors')
        exit(1)
    transforms = create_transforms(ast)
    courses = []
    for description in descriptions:
        lines = description.strip().splitlines()
        department = lines[0].strip()
        number = lines[1].strip()
        number = number[:number.index(' ')]
        for line in description.splitlines():
            courses.append(CourseDescription(department, number, line.strip()))
    for course in courses:
        for transformed in run_transforms(transforms, course):
            print(transformed.text)

if __name__ == '__main__':
    main()
